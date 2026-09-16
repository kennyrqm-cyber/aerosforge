import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const expected = "f70906cf6728891d8605653945091c078c87cfe6";
const path = "legacy/index.html";
if (!existsSync(path)) {
  console.error(`${path} is missing.`);
  process.exit(1);
}
const actual = execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();
if (actual !== expected) {
  console.error(`Legacy MVP mismatch. Expected Git blob ${expected}; got ${actual}.`);
  process.exit(1);
}
console.log(`Legacy MVP verified: ${actual}`);
