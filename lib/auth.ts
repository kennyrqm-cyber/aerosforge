import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { isAccountEmailDeliveryConfigured, sendAccountEmail } from "@/lib/account-email";
import { db } from "@/lib/db";

const buildPhase = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET
  ?? (buildPhase ? "build-only-secret-never-used-at-runtime" : undefined);
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
}

const configuredAllowedHosts = process.env.BETTER_AUTH_ALLOWED_HOSTS
  ?? "localhost:3000,127.0.0.1:3000";
const vercelAllowedHosts = [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
  .filter((host): host is string => Boolean(host));
const allowedHosts = [...new Set([
  ...configuredAllowedHosts.split(","),
  ...vercelAllowedHosts
])]
  .map((host) => host.trim())
  .filter(Boolean);

if (allowedHosts.length === 0) {
  throw new Error("BETTER_AUTH_ALLOWED_HOSTS must contain at least one trusted host.");
}

if (process.env.PUBLIC_SIGNUP_ENABLED === "true" && !isAccountEmailDeliveryConfigured()) {
  throw new Error("Public signup cannot open until verified account email delivery is configured.");
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret,
  baseURL: {
    allowedHosts,
    protocol: process.env.NODE_ENV === "development" ? "http" : "auto"
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAccountEmail({ kind: "verify-email", to: user.email, url });
    }
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.PUBLIC_SIGNUP_ENABLED !== "true",
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAccountEmail({ kind: "reset-password", to: user.email, url });
    },
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await db.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: user.id } });
    },
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
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 3 }
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
