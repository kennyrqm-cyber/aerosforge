import "dotenv/config";
import { defineConfig } from "prisma/config";

// Client generation does not connect to PostgreSQL, but Prisma still requires a
// syntactically valid datasource URL while loading this config. Migration and
// seed commands will fail closed at connection time unless a real URL is set.
const datasourceUrl = process.env.DIRECT_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgresql://build:build@127.0.0.1:5432/aerosforge_build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: datasourceUrl }
});
