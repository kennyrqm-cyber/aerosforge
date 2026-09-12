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
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length) {
  console.error("AEROSFORGE ONE post-deploy smoke test FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`AEROSFORGE ONE post-deploy smoke test passed for ${base}`);
