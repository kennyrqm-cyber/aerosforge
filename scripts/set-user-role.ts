import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
if (process.env.ALLOW_ROLE_BOOTSTRAP !== "I_UNDERSTAND") {
  throw new Error("Refusing privileged role change. Set ALLOW_ROLE_BOOTSTRAP=I_UNDERSTAND for this one command.");
}

const email = (process.argv[2] || "").trim().toLowerCase();
const requestedRole = (process.argv[3] || "").trim().toUpperCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Usage: npm run role:set -- user@example.com ADMIN|CFI|STUDENT");
if (!Object.values(Role).includes(requestedRole as Role)) throw new Error("Role must be STUDENT, CFI, or ADMIN.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user exists for ${email}. The user must sign up first.`);
  const nextRole = requestedRole as Role;
  if (user.role === nextRole) {
    console.log(`${email} already has role ${nextRole}; no change made.`);
    process.exit(0);
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: nextRole } });
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: "PRIVILEGED_ROLE_CHANGED_BY_CLI",
        entityType: "User",
        entityId: user.id,
        metadata: { email, previousRole: user.role, nextRole, mechanism: "scripts/set-user-role.ts" }
      }
    });
  });
  console.log(`Role changed for ${email}: ${user.role} -> ${nextRole}. Audit event recorded.`);
} finally {
  await db.$disconnect();
}
