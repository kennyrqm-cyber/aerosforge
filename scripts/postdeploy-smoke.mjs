const rawBase = process.env.APP_URL || process.argv[2];
if (!rawBase) {
  console.error("Usage: APP_URL=https://preview.example.com npm run smoke:postdeploy");
  process.exit(2);
}
const base = rawBase.replace(/\/$/, "");
const failures = [];

async function request(path, init = {}) {
  return fetch(`${base}${path}`, { redirect: "manual", ...init });
}

function expectRedirectToSignIn(response, path) {
  if (![302, 303, 307, 308].includes(response.status)) {
    failures.push(`${path} returned ${response.status}, expected an unauthenticated redirect`);
    return;
  }
  const location = response.headers.get("location") || "";
  if (!location.includes("/sign-in")) failures.push(`${path} redirected to ${location || "<missing>"}, expected /sign-in`);
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  return values.filter(Boolean).map((value) => value.split(";", 1)[0]).join("; ");
}

async function signInTestIdentity(email, password) {
  const response = await request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "origin": base
    },
    body: JSON.stringify({ email, password })
  });
  if (response.status !== 200) {
    const detail = (await response.text()).slice(0, 300);
    failures.push(`${email} sign-in returned ${response.status}, expected 200: ${detail}`);
    return "";
  }
  const cookie = cookieHeader(response);
  if (!cookie) failures.push(`${email} sign-in did not return a session cookie`);
  return cookie;
}

async function expectRoleFlow({ email, password, dashboardPath, marker, forbiddenPath }) {
  const cookie = await signInTestIdentity(email, password);
  if (!cookie) return;
  const headers = { cookie };
  const router = await request("/dashboard", { headers });
  if (![302, 303, 307, 308].includes(router.status)) {
    failures.push(`${email} dashboard router returned ${router.status}, expected redirect`);
  } else if (!String(router.headers.get("location") || "").includes(dashboardPath)) {
    failures.push(`${email} dashboard router did not select ${dashboardPath}`);
  }
  const dashboard = await request(dashboardPath, { headers });
  const html = await dashboard.text();
  if (dashboard.status !== 200 || !html.includes(marker)) {
    failures.push(`${email} could not render its role-owned dashboard`);
  }
  const forbidden = await request(forbiddenPath, { headers });
  if (![302, 303, 307, 308].includes(forbidden.status)) {
    failures.push(`${email} accessed forbidden route ${forbiddenPath} with status ${forbidden.status}`);
  }
  return cookie;
}

try {
  const home = await request("/");
  if (home.status !== 200) failures.push(`/ returned ${home.status}, expected 200`);
  if (home.headers.get("x-frame-options") !== "DENY") failures.push(`/ is missing X-Frame-Options: DENY`);
  if (home.headers.get("x-content-type-options") !== "nosniff") failures.push(`/ is missing X-Content-Type-Options: nosniff`);

  const winchester = await request("/winchester");
  if (winchester.status !== 200) failures.push(`/winchester returned ${winchester.status}, expected 200`);

  const privacy = await request("/privacy");
  if (privacy.status !== 200) failures.push(`/privacy returned ${privacy.status}, expected 200`);

  const signup = await request("/sign-up");
  if (signup.status !== 200) failures.push(`/sign-up returned ${signup.status}, expected 200`);

  const recovery = await request("/forgot-password");
  const recoveryHtml = await recovery.text();
  if (recovery.status !== 200) failures.push(`/forgot-password returned ${recovery.status}, expected 200`);
  if (process.env.EXPECT_EMAIL_DELIVERY_DISABLED === "true" && !recoveryHtml.includes("Account recovery is not open yet")) {
    failures.push(`/forgot-password did not fail closed while account email delivery was disabled`);
  }

  const reset = await request("/reset-password");
  const resetHtml = await reset.text();
  if (reset.status !== 200) failures.push(`/reset-password returned ${reset.status}, expected 200`);
  if (process.env.EXPECT_EMAIL_DELIVERY_DISABLED === "true" && !resetHtml.includes("Account recovery is not open yet")) {
    failures.push(`/reset-password did not fail closed while account email delivery was disabled`);
  }

  const health = await request("/api/health");
  if (health.status !== 200) {
    failures.push(`/api/health returned ${health.status}, expected 200`);
  } else {
    const body = await health.json().catch(() => null);
    if (!body?.ok || body?.database !== "reachable") failures.push(`/api/health payload is not healthy`);
    const cache = health.headers.get("cache-control") || "";
    if (!cache.includes("no-store")) failures.push(`/api/health must be no-store`);
  }

  expectRedirectToSignIn(await request("/dashboard"), "/dashboard");
  expectRedirectToSignIn(await request("/academy"), "/academy");
  expectRedirectToSignIn(await request("/gauntlet"), "/gauntlet");

  const session = await request("/api/auth/get-session");
  if (session.status !== 200) failures.push(`/api/auth/get-session returned ${session.status}, expected 200`);

  if (process.env.E2E_TEST_IDENTITIES_ENABLED === "true") {
    const password = process.env.E2E_TEST_PASSWORD || "";
    const studentCookie = await expectRoleFlow({
      email: "student.e2e@aerosforge.test",
      password,
      dashboardPath: "/dashboard/student",
      marker: "Student dashboard",
      forbiddenPath: "/dashboard/admin"
    });
    if (studentCookie) {
      const headers = { cookie: studentCookie };
      const academy = await request("/academy", { headers });
      const academyHtml = await academy.text();
      if (academy.status !== 200 || !academyHtml.includes("Helicopter Fundamentals")) {
        failures.push("Published lesson did not render for the Student role.");
      }
      const gauntlet = await request("/gauntlet", { headers });
      const gauntletHtml = await gauntlet.text();
      if (gauntlet.status !== 200 || !gauntletHtml.includes("High Density Altitude Decision")) {
        failures.push("Published scenario did not render for the Student role.");
      }
    }
    await expectRoleFlow({
      email: "cfi.e2e@aerosforge.test",
      password,
      dashboardPath: "/dashboard/cfi",
      marker: "CFI dashboard",
      forbiddenPath: "/dashboard/admin"
    });
    await expectRoleFlow({
      email: "admin.e2e@aerosforge.test",
      password,
      dashboardPath: "/dashboard/admin",
      marker: "Owner dashboard",
      forbiddenPath: "/dashboard/student"
    });
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length) {
  console.error("AEROSFORGE ONE post-deploy smoke test FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`AEROSFORGE ONE post-deploy smoke test passed for ${base}`);
