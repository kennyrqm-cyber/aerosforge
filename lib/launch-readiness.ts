import { LaunchGateStatus, Prisma, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const CHECKRIDE_LAUNCH_GATES = [
  {
    key: "CHECKRIDE_CONTENT_APPROVAL",
    version: 1,
    category: "Training",
    authority: "Independent CFI",
    title: "Paid content approved",
    requirement: "The exact founding-cohort lessons and scenarios have current-version CFI approval and Admin publication evidence."
  },
  {
    key: "CHECKRIDE_COHORT_REHEARSAL",
    version: 1,
    category: "Delivery",
    authority: "Operations owner",
    title: "Cohort delivery rehearsed",
    requirement: "A dated rehearsal proves onboarding, calendar, support, capacity, lesson delivery, escalation, and completion workflows."
  },
  {
    key: "STRIPE_SANDBOX_DRILL",
    version: 1,
    category: "Payments",
    authority: "Payments owner",
    title: "Stripe sandbox drills passed",
    requirement: "Payment, expiration, delayed success, failure, refund, dispute, webhook replay, and reconciliation drills are evidenced."
  },
  {
    key: "TERMS_PRIVACY_REFUND_REVIEW",
    version: 1,
    category: "Legal",
    authority: "Qualified reviewer",
    title: "Terms, privacy, and refunds reviewed",
    requirement: "The production notices, vendor disclosures, retention rules, refund terms, and customer promises received qualified review."
  },
  {
    key: "ACCOUNT_EMAIL_FLOW",
    version: 1,
    category: "Identity",
    authority: "Security owner",
    title: "Account email flow proven",
    requirement: "Sending-domain verification, account verification, password recovery, session revocation, and support recovery work end to end."
  },
  {
    key: "CFI_IDENTITY_CONTROL",
    version: 1,
    category: "Identity",
    authority: "Founder",
    title: "CFI identity controls approved",
    requirement: "CFI identity and certificate review plus documented Admin-only role elevation prevent self-asserted instructor access."
  },
  {
    key: "BACKUP_RESTORE_DRILL",
    version: 1,
    category: "Resilience",
    authority: "Database owner",
    title: "Backup restoration proven",
    requirement: "A Neon restoration drill documents recovery time, recovery point, validation, owner, and evidence location."
  },
  {
    key: "MONITORING_SUPPORT_ON_CALL",
    version: 1,
    category: "Operations",
    authority: "On-call owner",
    title: "Monitoring and support staffed",
    requirement: "Deployment, runtime, database, payment, privacy, and customer-support alerts have a named response owner and escalation path."
  },
  {
    key: "ACCESSIBILITY_STUDENT_ACCEPTANCE",
    version: 1,
    category: "Quality",
    authority: "Acceptance owner",
    title: "Accessibility and student acceptance passed",
    requirement: "Supported mobile/desktop flows and a real helicopter-student rehearsal are documented with critical findings resolved."
  }
] as const;

export type CheckrideLaunchGateKey = typeof CHECKRIDE_LAUNCH_GATES[number]["key"];
export const CHECKRIDE_LAUNCH_GATE_KEYS = CHECKRIDE_LAUNCH_GATES.map((gate) => gate.key);

type LaunchGateReader = Pick<Prisma.TransactionClient, "launchGateDecision">;

function isGateKey(value: string): value is CheckrideLaunchGateKey {
  return CHECKRIDE_LAUNCH_GATES.some((gate) => gate.key === value);
}

export async function getCheckrideLaunchReadiness(client: LaunchGateReader = db) {
  const decisions = await client.launchGateDecision.findMany({
    where: { gateKey: { in: CHECKRIDE_LAUNCH_GATE_KEYS } },
    orderBy: { gateKey: "asc" }
  });
  const decisionByKey = new Map(decisions.map((decision) => [decision.gateKey, decision]));
  const gates = CHECKRIDE_LAUNCH_GATES.map((definition) => {
    const decision = decisionByKey.get(definition.key);
    const currentVersion = decision?.gateVersion === definition.version;
    const status = currentVersion ? decision.status : LaunchGateStatus.BLOCKED;
    return {
      ...definition,
      status,
      stale: Boolean(decision && !currentVersion),
      evidence: decision?.evidence ?? null,
      reviewerName: decision?.reviewerName ?? null,
      approvedAt: currentVersion ? decision?.approvedAt ?? null : null,
      updatedAt: decision?.updatedAt ?? null
    };
  });
  const approvedCount = gates.filter((gate) => gate.status === LaunchGateStatus.APPROVED).length;
  return {
    gates,
    approvedCount,
    total: gates.length,
    ready: approvedCount === gates.length
  };
}

export async function assertCheckrideLaunchGatesApproved(client: LaunchGateReader = db) {
  const readiness = await getCheckrideLaunchReadiness(client);
  if (!readiness.ready) {
    throw new Error("Checkride checkout is blocked until every launch-readiness gate has current approval evidence.");
  }
}

export async function updateLaunchGateDecisionWorkflow(input: {
  actor: { id: string; role: Role };
  gateKey: string;
  status: LaunchGateStatus;
  evidence?: string | null;
  reviewerName?: string | null;
  expectedUpdatedAt: Date | null;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update launch-readiness gates.");
  if (!isGateKey(input.gateKey)) throw new Error("Unknown launch-readiness gate.");
  const definition = CHECKRIDE_LAUNCH_GATES.find((gate) => gate.key === input.gateKey)!;
  const evidence = input.evidence?.trim() || null;
  const reviewerName = input.reviewerName?.trim() || null;
  if (evidence && evidence.length > 2000) throw new Error("Launch-gate evidence is too long.");
  if (reviewerName && reviewerName.length > 160) throw new Error("Launch-gate reviewer is too long.");
  if (input.status !== LaunchGateStatus.BLOCKED && (!evidence || evidence.length < 20)) {
    throw new Error("Submitted or approved launch gates require a meaningful evidence reference.");
  }
  if (input.status === LaunchGateStatus.APPROVED && (!reviewerName || reviewerName.length < 3)) {
    throw new Error("Approved launch gates require the accountable reviewer name or role.");
  }

  return db.$transaction(async (tx) => {
    const previous = await tx.launchGateDecision.findUnique({ where: { gateKey: input.gateKey } });
    if ((previous?.updatedAt.getTime() ?? null) !== (input.expectedUpdatedAt?.getTime() ?? null)) {
      throw new Error("Launch-gate evidence changed after this form loaded. Refresh and review the latest decision.");
    }
    const approvedAt = input.status === LaunchGateStatus.APPROVED ? new Date() : null;
    const decision = await tx.launchGateDecision.upsert({
      where: { gateKey: input.gateKey },
      update: {
        gateVersion: definition.version,
        status: input.status,
        evidence,
        reviewerName,
        approvedAt,
        updatedById: input.actor.id
      },
      create: {
        gateKey: input.gateKey,
        gateVersion: definition.version,
        status: input.status,
        evidence,
        reviewerName,
        approvedAt,
        updatedById: input.actor.id
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "LAUNCH_GATE_UPDATED",
        entityType: "LaunchGateDecision",
        entityId: decision.id,
        metadata: {
          gateKey: input.gateKey,
          previousGateVersion: previous?.gateVersion ?? null,
          gateVersion: definition.version,
          previousStatus: previous?.status ?? null,
          status: input.status,
          previousEvidence: previous?.evidence ?? null,
          evidence,
          evidenceLength: evidence?.length ?? 0,
          previousReviewerName: previous?.reviewerName ?? null,
          reviewerName,
          previousApprovedAt: previous?.approvedAt?.toISOString() ?? null,
          approvedAt: approvedAt?.toISOString() ?? null
        }
      }
    });
    return decision;
  }, { isolationLevel: "Serializable" });
}
