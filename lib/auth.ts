import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { db } from "@/lib/db";

const buildPhase = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET
  ?? (buildPhase ? "build-only-secret-never-used-at-runtime" : undefined);
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
}

const allowedHosts = (process.env.BETTER_AUTH_ALLOWED_HOSTS ?? "localhost:3000,127.0.0.1:3000")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

if (allowedHosts.length === 0) {
  throw new Error("BETTER_AUTH_ALLOWED_HOSTS must contain at least one trusted host.");
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret,
  baseURL: {
    allowedHosts,
    protocol: process.env.NODE_ENV === "development" ? "http" : "auto"
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.PUBLIC_SIGNUP_ENABLED !== "true",
    requireEmailVerification: false,
    minPasswordLength: 10,
    maxPasswordLength: 128
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 }
    }
  },
  user: {
    additionalFields: {
      role: {
        type: ["STUDENT", "CFI", "ADMIN"],
        required: false,
        defaultValue: "STUDENT",
        input: false
      }
    }
  },
  advanced: { database: { joins: true } }
});
