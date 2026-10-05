import { ContentStatus, ReviewDecision, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const REVIEWABLE_CONTENT_STATUSES = new Set<ContentStatus>([
  ContentStatus.DRAFT,
  ContentStatus.IN_REVIEW
]);

type WorkflowActor = { id: string; role: Role };

export async function reviewLessonWorkflow(input: {
  actor: WorkflowActor;
  lessonId: string;
  decision: ReviewDecision;
  notes?: string;
}) {
  const { actor, lessonId, decision, notes } = input;
  if (actor.role !== Role.CFI && actor.role !== Role.ADMIN) {
    throw new Error("Only a CFI or Admin can review lessons.");
  }
  if (decision === ReviewDecision.APPROVED && actor.role !== Role.CFI) {
    throw new Error("Only a CFI can issue the approval required for publication.");
  }

  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !REVIEWABLE_CONTENT_STATUSES.has(lesson.status)) {
    throw new Error("Only draft or in-review lessons can be reviewed.");
  }
  if (decision === ReviewDecision.APPROVED) {
    if (!lesson.contentMd || lesson.contentMd.trim().length < 400) {
      throw new Error("A lesson needs substantive reviewed content before approval.");
    }
    if (!lesson.sourceNotes || lesson.sourceNotes.trim().length < 20) {
      throw new Error("Source notes are required before approval.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.contentReview.create({
      data: { lessonId, reviewerId: actor.id, version: lesson.version, decision, notes }
    });
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        status: decision === ReviewDecision.APPROVED ? ContentStatus.APPROVED : ContentStatus.IN_REVIEW,
        reviewedAt: decision === ReviewDecision.APPROVED ? new Date() : lesson.reviewedAt
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "LESSON_REVIEWED",
        entityType: "Lesson",
        entityId: lessonId,
        metadata: { decision, version: lesson.version }
      }
    });
  });
}

export async function publishLessonWorkflow(input: { actor: WorkflowActor; lessonId: string }) {
  const { actor, lessonId } = input;
  if (actor.role !== Role.ADMIN) throw new Error("Only an Admin can publish lessons.");
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.status !== ContentStatus.APPROVED) {
    throw new Error("Only approved lessons can be published.");
  }
  const independentApproval = await db.contentReview.findFirst({
    where: {
      lessonId,
      version: lesson.version,
      decision: ReviewDecision.APPROVED,
      reviewerId: { not: actor.id },
      reviewer: { role: Role.CFI }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (!independentApproval) {
    throw new Error("Publication requires approval from a CFI other than the publishing admin.");
  }

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lessonId },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() }
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "LESSON_PUBLISHED",
        entityType: "Lesson",
        entityId: lessonId,
        metadata: { version: lesson.version }
      }
    });
  });
}

export async function reviewScenarioWorkflow(input: {
  actor: WorkflowActor;
  scenarioId: string;
  decision: ReviewDecision;
  notes?: string;
}) {
  const { actor, scenarioId, decision, notes } = input;
  if (actor.role !== Role.CFI && actor.role !== Role.ADMIN) {
    throw new Error("Only a CFI or Admin can review scenarios.");
  }
  if (decision === ReviewDecision.APPROVED && actor.role !== Role.CFI) {
    throw new Error("Only a CFI can issue the approval required for publication.");
  }
  const scenario = await db.gauntletScenario.findUnique({ where: { id: scenarioId } });
  if (!scenario || !REVIEWABLE_CONTENT_STATUSES.has(scenario.status)) {
    throw new Error("Only draft or in-review scenarios can be reviewed.");
  }
  const choices = Array.isArray(scenario.choices) ? scenario.choices : [];
  const choiceKeys = choices.flatMap((choice) =>
    choice && typeof choice === "object" && "key" in choice
      ? [String((choice as { key: unknown }).key)]
      : []
  );
  if (decision === ReviewDecision.APPROVED) {
    if (scenario.prompt.trim().length < 80 || scenario.explanation.trim().length < 80) {
      throw new Error("Scenario needs substantive prompt and explanation before approval.");
    }
    if (choiceKeys.length < 3 || !choiceKeys.includes(scenario.correctChoiceKey)) {
      throw new Error("Scenario choices or correct answer are invalid.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.gauntletReview.create({
      data: { scenarioId, reviewerId: actor.id, version: scenario.version, decision, notes }
    });
    await tx.gauntletScenario.update({
      where: { id: scenarioId },
      data: { status: decision === ReviewDecision.APPROVED ? ContentStatus.APPROVED : ContentStatus.IN_REVIEW }
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "GAUNTLET_REVIEWED",
        entityType: "GauntletScenario",
        entityId: scenarioId,
        metadata: { decision, version: scenario.version }
      }
    });
  });
}

export async function publishScenarioWorkflow(input: { actor: WorkflowActor; scenarioId: string }) {
  const { actor, scenarioId } = input;
  if (actor.role !== Role.ADMIN) throw new Error("Only an Admin can publish scenarios.");
  const scenario = await db.gauntletScenario.findUnique({ where: { id: scenarioId } });
  if (!scenario || scenario.status !== ContentStatus.APPROVED) {
    throw new Error("Only approved scenarios can be published.");
  }
  const independentApproval = await db.gauntletReview.findFirst({
    where: {
      scenarioId,
      version: scenario.version,
      decision: ReviewDecision.APPROVED,
      reviewerId: { not: actor.id },
      reviewer: { role: Role.CFI }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (!independentApproval) {
    throw new Error("Publication requires approval from a CFI other than the publishing admin.");
  }

  await db.$transaction(async (tx) => {
    await tx.gauntletScenario.update({
      where: { id: scenarioId },
      data: { status: ContentStatus.PUBLISHED }
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "GAUNTLET_PUBLISHED",
        entityType: "GauntletScenario",
        entityId: scenarioId,
        metadata: { version: scenario.version }
      }
    });
  });
}
