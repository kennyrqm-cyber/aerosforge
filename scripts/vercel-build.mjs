import { spawnSync } from "node:child_process";
import path from "node:path";

const prismaBin = path.resolve("node_modules/prisma/build/index.js");
const nextBin = path.resolve("node_modules/next/dist/bin/next");

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// RC3 preview owns its isolated database. Production migrations stay a
// deliberate release action until the controlled-launch gates are approved.
if (process.env.VERCEL_ENV === "preview" && process.env.DATABASE_URL) {
  run(prismaBin, ["migrate", "deploy"]);
  run(prismaBin, ["db", "seed"]);
}

run(prismaBin, ["generate"]);
run(nextBin, ["build"]);
