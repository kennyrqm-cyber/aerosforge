import "dotenv/config";
import { ContentStatus, ReviewDecision, Role } from "../generated/prisma/client";
import {
  publishLessonWorkflow,
  publishScenarioWorkflow,
  reviewLessonWorkflow,
  reviewScenarioWorkflow
} from "../lib/content-workflow";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Content workflow integration runs only with GitHub Actions test identities.");
}

async function expectRejection(action: () => Promise<unknown>, message: string) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === message) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${message}`);
}

async function main() {
  const [student, cfi, admin, lesson, scenario] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "cfi.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "admin.e2e@aerosforge.test" } }),
    db.lesson.findUniqueOrThrow({ where: { slug: "helicopter-fundamentals" } }),
    db.gauntletScenario.findUniqueOrThrow({ where: { slug: "density-altitude-fuel-escape-options" } })
  ]);

  if (student.role !== Role.STUDENT || cfi.role !== Role.CFI || admin.role !== Role.ADMIN) {
    throw new Error("Test identities do not have the expected server-owned roles.");
  }

  const reviewedContent = [
    "Helicopter lift depends on the rotor system accelerating air through the rotor disc.",
    "The pilot manages attitude, thrust, yaw, and power with coordinated control inputs.",
    "This review fixture exists only in the disposable CI database and is not production training content.",
    "Students must use current FAA guidance, the approved aircraft flight manual, and qualified instruction.",
    "Aeronautical decision-making protects margins by considering aircraft, environment, pilot, and mission risk."
  ].join("\n\n");
  await db.lesson.update({
    where: { id: lesson.id },
    data: {
      contentMd: reviewedContent,
      sourceNotes: "CI fixture referencing the FAA Helicopter Flying Handbook; instructor review remains mandatory.",
      status: ContentStatus.DRAFT,
      reviewedAt: null,
      publishedAt: null
    }
  });

  await expectRejection(
    () => reviewLessonWorkflow({
      actor: { id: admin.id, role: admin.role },
      lessonId: lesson.id,
      decision: ReviewDecision.APPROVED
    }),
    "Only a CFI can issue the approval required for publication."
  );
  await reviewLessonWorkflow({
    actor: { id: cfi.id, role: cfi.role },
    lessonId: lesson.id,
    decision: ReviewDecision.APPROVED,
    notes: "CI confirms independent CFI approval against this exact lesson version."
  });
  await publishLessonWorkflow({ actor: { id: admin.id, role: admin.role }, lessonId: lesson.id });

  await expectRejection(
    () => reviewScenarioWorkflow({
      actor: { id: admin.id, role: admin.role },
      scenarioId: scenario.id,
      decision: ReviewDecision.APPROVED
    }),
    "Only a CFI can issue the approval required for publication."
  );
  await reviewScenarioWorkflow({
    actor: { id: cfi.id, role: cfi.role },
    scenarioId: scenario.id,
    decision: ReviewDecision.APPROVED,
    notes: "CI confirms independent CFI approval against this exact scenario version."
  });
  await publishScenarioWorkflow({ actor: { id: admin.id, role: admin.role }, scenarioId: scenario.id });

  const [publishedLesson, publishedScenario, auditCount] = await Promise.all([
    db.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    db.gauntletScenario.findUniqueOrThrow({ where: { id: scenario.id } }),
    db.auditEvent.count({
      where: {
        action: { in: ["LESSON_REVIEWED", "LESSON_PUBLISHED", "GAUNTLET_REVIEWED", "GAUNTLET_PUBLISHED"] }
      }
    })
  ]);
  if (publishedLesson.status !== ContentStatus.PUBLISHED || !publishedLesson.publishedAt) {
    throw new Error("Independently reviewed lesson was not published.");
  }
  if (publishedScenario.status !== ContentStatus.PUBLISHED) {
    throw new Error("Independently reviewed scenario was not published.");
  }
  if (auditCount !== 4) throw new Error(`Expected 4 workflow audit events; found ${auditCount}.`);

  console.log("Independent CFI review → Admin publication integration passed for lesson and scenario.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
