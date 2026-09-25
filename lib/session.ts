import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export async function getAppSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const role = (session.user as typeof session.user & { role?: Role }).role ?? Role.STUDENT;
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email, role } };
}

export async function requireUser() {
  const session = await getAppSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireUser();
  if (!roles.includes(session.user.role)) redirect("/dashboard");
  return session;
}
