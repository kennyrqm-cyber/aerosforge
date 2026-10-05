import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Role } from "@/generated/prisma/client";
export default async function DashboardRouter(){const session=await requireUser();const destinations:Record<Role,string>={STUDENT:"/dashboard/student",CFI:"/dashboard/cfi",ADMIN:"/dashboard/admin"};redirect(destinations[session.user.role]);}
