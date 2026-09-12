import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL must be configured for Prisma CLI operations.");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: datasourceUrl }
});
