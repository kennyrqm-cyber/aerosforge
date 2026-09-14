import { LeadStatus, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type CheckrideLeadInput = {
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  certificateLevel: string;
  ratingGoal: string;
  aircraft?: string;
  targetCheckride?: string;
  biggestChallenge?: string;
  preferredFormat?: string;
  source?: string;
  campaign?: string;
  contactConsent: true;
  privacyVersion: string;
};

export async function createCheckrideLead(input: CheckrideLeadInput) {
  const recent = await db.checkrideLead.findFirst({
    where: {
      email: input.email,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (recent) return { id: recent.id, created: false };

  const lead = await db.$transaction(async (tx) => {
    const created = await tx.checkrideLead.create({
      data: {
        ...input,
        consentAt: new Date()
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.userId,
        action: "CHECKRIDE_LEAD_CREATED",
        entityType: "CheckrideLead",
        entityId: created.id,
        metadata: { ratingGoal: input.ratingGoal, source: input.source, campaign: input.campaign }
      }
    });
    return created;
  });
  return { id: lead.id, created: true };
}

export async function updateCheckrideLeadStatusWorkflow(input: {
  actor: { id: string; role: Role };
  leadId: string;
  status: LeadStatus;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update checkride leads.");
  const lead = await db.checkrideLead.findUnique({ where: { id: input.leadId }, select: { status: true } });
  if (!lead) throw new Error("Checkride lead not found.");
  await db.$transaction(async (tx) => {
    await tx.checkrideLead.update({ where: { id: input.leadId }, data: { status: input.status } });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_LEAD_STATUS_UPDATED",
        entityType: "CheckrideLead",
        entityId: input.leadId,
        metadata: { previousStatus: lead.status, status: input.status }
      }
    });
  });
}
