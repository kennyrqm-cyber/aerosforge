import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];
if (!existsSync("package-lock.json")) failures.push("package-lock.json is missing");
if (!existsSync("legacy/index.html")) {
  failures.push("legacy/index.html is missing; run npm run legacy:preserve from the verified current repository before root replacement");
} else {
  const expectedLegacyBlob = "f70906cf6728891d8605653945091c078c87cfe6";
  const actualLegacyBlob = execFileSync("git", ["hash-object", "legacy/index.html"], { encoding: "utf8" }).trim();
  if (actualLegacyBlob !== expectedLegacyBlob) failures.push(`legacy/index.html integrity mismatch: expected ${expectedLegacyBlob}, got ${actualLegacyBlob}`);
}
if (existsSync("package.json")) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (pkg.engines?.node !== ">=20.19.0") failures.push("Node engine guard changed unexpectedly");
  if (pkg.dependencies?.stripe !== "22.4.0") failures.push("Stripe SDK must remain pinned to the reviewed 22.4.0 release");
  if (pkg.overrides?.mysql2 !== "3.24.4" || pkg.overrides?.["deepmerge-ts"] !== "8.0.2") {
    failures.push("reviewed high-severity transitive dependency fixes are missing");
  }
}

if (failures.length) {
  console.error("AEROSFORGE ONE release gates are NOT satisfied:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("AEROSFORGE ONE release gates satisfied.");
