"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin by default. This avoids preview deployments accidentally calling
// the production auth host and lets Better Auth resolve the current deployment.
export const authClient = createAuthClient();
