import "dotenv/config";
import { LaunchGateStatus, Role } from "../generated/prisma/client";
import {
  CHECKRIDE_LAUNCH_GATES,
  getCheckrideLaunchReadiness,
  updateLaunchGateDecisionWorkflow
} from "../lib/launch-readiness";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Launch-readiness integration runs only with GitHub Actions test identities.");
}

async function expectRejection(action: () => Promise<unknown>, expected: string) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === expected) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${expected}`);
}

async function main() {
  const [admin, student] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "admin.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } })
  ]);
  const firstGate = CHECKRIDE_LAUNCH_GATES[0];

  await expectRejection(
    () => updateLaunchGateDecisionWorkflow({
      actor: { id: student.id, role: Role.STUDENT }, gateKey: firstGate.key,
      status: LaunchGateStatus.BLOCKED
    }),
    "Only an Admin can update launch-readiness gates."
  );
  await expectRejection(
    () => updateLaunchGateDecisionWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, gateKey: "UNKNOWN_GATE",
      status: LaunchGateStatus.BLOCKED
    }),
    "Unknown launch-readiness gate."
  );
  await expectRejection(
    () => updateLaunchGateDecisionWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, gateKey: firstGate.key,
      status: LaunchGateStatus.APPROVED, evidence: "too short", reviewerName: "QA"
    }),
    "Submitted or approved launch gates require a meaningful evidence reference."
  );
  await expectRejection(
    () => updateLaunchGateDecisionWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, gateKey: firstGate.key,
      status: LaunchGateStatus.APPROVED,
      evidence: "Integration evidence with a dated, attributable result.", reviewerName: ""
    }),
    "Approved launch gates require the accountable reviewer name or role."
  );

  for (const gate of CHECKRIDE_LAUNCH_GATES) {
    await updateLaunchGateDecisionWorkflow({
      actor: { id: admin.id, role: Role.ADMIN },
      gateKey: gate.key,
      status: LaunchGateStatus.APPROVED,
      evidence: `CI integration evidence for ${gate.key}; reviewed against gate version ${gate.version}.`,
      reviewerName: `CI ${gate.authority}`
    });
  }
  const approved = await getCheckrideLaunchReadiness();
  if (!approved.ready || approved.approvedCount !== approved.total || approved.total !== CHECKRIDE_LAUNCH_GATES.length) {
    throw new Error("Complete current launch evidence did not unlock readiness.");
  }

  await db.launchGateDecision.update({ where: { gateKey: firstGate.key }, data: { gateVersion: firstGate.version + 1 } });
  const stale = await getCheckrideLaunchReadiness();
  const staleGate = stale.gates.find((gate) => gate.key === firstGate.key);
  if (stale.ready || !staleGate?.stale || staleGate.status !== LaunchGateStatus.BLOCKED) {
    throw new Error("Stale launch evidence did not fail closed.");
  }

  await updateLaunchGateDecisionWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, gateKey: firstGate.key,
    status: LaunchGateStatus.APPROVED,
    evidence: "CI refreshed evidence after the launch-gate definition changed.",
    reviewerName: "CI Independent CFI"
  });
  const restored = await getCheckrideLaunchReadiness();
  const auditCount = await db.auditEvent.count({ where: { action: "LAUNCH_GATE_UPDATED" } });
  if (!restored.ready || auditCount < CHECKRIDE_LAUNCH_GATES.length + 1) {
    throw new Error("Launch-gate recovery or audit accountability failed.");
  }

  console.log("Admin-only evidence → complete approval → stale-version lockout → audited recovery passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
