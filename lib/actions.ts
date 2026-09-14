"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AssignmentStatus, ContentStatus, LeadStatus, ProgressStatus, ReviewDecision, Role } from "@/generated/prisma/client";
import {
  publishLessonWorkflow,
  publishScenarioWorkflow,
  reviewLessonWorkflow,
  reviewScenarioWorkflow
} from "@/lib/content-workflow";
import { createCheckrideLead, updateCheckrideLeadStatusWorkflow } from "@/lib/checkride-leads";
import { db } from "@/lib/db";
import { getAppSession, requireRole } from "@/lib/session";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

function requiredText(value: FormDataEntryValue | string | null | undefined, field: string, max = 160) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${field} is required.`);
  if (normalized.length > max) throw new Error(`${field} is too long.`);
  return normalized;
}

function optionalText(value: FormDataEntryValue | string | null | undefined, max = 2000) {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new Error("Input is too long.");
  return normalized;
}

function normalizedEmail(value: FormDataEntryValue | string | null | undefined) {
  const email = requiredText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

async function awardLessonBadges(userId: string) {
  const completedLessons = await db.lessonProgress.count({
    where: { userId, status: ProgressStatus.COMPLETED }
  });
  const keys = [
    ...(completedLessons >= 1 ? ["first-lesson"] : []),
    ...(completedLessons >= 5 ? ["five-lessons"] : []),
    ...(completedLessons >= 30 ? ["academy-complete"] : [])
  ];
  if (keys.length === 0) return;
  const badges = await db.badge.findMany({ where: { key: { in: keys } } });
  for (const badge of badges) {
    await db.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: {},
      create: { userId, badgeId: badge.id }
    });
  }
}

export async function completeLesson(lessonId: string) {
  const session = await requireRole(Role.STUDENT);
  const safeLessonId = requiredText(lessonId, "Lesson", 128);
  const lesson = await db.lesson.findFirst({
    where: { id: safeLessonId, status: ContentStatus.PUBLISHED }
  });
  if (!lesson) throw new Error("Lesson is unavailable.");

  await db.$transaction(async (tx) => {
    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId: safeLessonId } }
    });
    const firstCompletion = existing?.status !== ProgressStatus.COMPLETED;
    const xpAwarded = firstCompletion ? 250 : existing?.xpAwarded ?? 0;

    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId: safeLessonId } },
      update: {
        status: ProgressStatus.COMPLETED,
        percent: 100,
        completedAt: existing?.completedAt ?? new Date(),
        xpAwarded
      },
      create: {
        userId: session.user.id,
        lessonId: safeLessonId,
        status: ProgressStatus.COMPLETED,
        percent: 100,
        startedAt: new Date(),
        completedAt: new Date(),
        xpAwarded
      }
    });

    if (firstCompletion) {
      await tx.auditEvent.create({
        data: {
          actorId: session.user.id,
          action: "LESSON_COMPLETED",
          entityType: "Lesson",
          entityId: safeLessonId,
          metadata: { xpAwarded }
        }
      });
    }
  });

  await awardLessonBadges(session.user.id);
  revalidatePath("/academy");
  revalidatePath("/dashboard/student");
}

export async function submitGauntletAttempt(scenarioId: string, formData: FormData) {
  const session = await requireRole(Role.STUDENT);
  const safeScenarioId = requiredText(scenarioId, "Scenario", 128);
  const selectedChoiceKey = requiredText(formData.get("choice"), "Choice", 40);
  const scenario = await db.gauntletScenario.findFirst({
    where: { id: safeScenarioId, status: ContentStatus.PUBLISHED }
  });
  if (!scenario) throw new Error("Scenario is unavailable.");

  const choices = Array.isArray(scenario.choices) ? scenario.choices : [];
  const validChoice = choices.some((choice) => {
    if (!choice || typeof choice !== "object" || !("key" in choice)) return false;
    return String((choice as { key: unknown }).key) === selectedChoiceKey;
  });
  if (!validChoice) throw new Error("Invalid scenario choice.");

  const correct = selectedChoiceKey === scenario.correctChoiceKey;
  const result = await db.$transaction(async (tx) => {
    const previousCorrect = correct
      ? await tx.gauntletAttempt.findFirst({
          where: { userId: session.user.id, scenarioId: safeScenarioId, correct: true },
          select: { id: true }
        })
      : null;
    const xpAwarded = correct && !previousCorrect ? scenario.xpValue : 0;
    const attempt = await tx.gauntletAttempt.create({
      data: {
        userId: session.user.id,
        scenarioId: safeScenarioId,
        selectedChoiceKey,
        correct,
        score: correct ? 100 : 0,
        xpAwarded
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: session.user.id,
        action: "GAUNTLET_ATTEMPTED",
        entityType: "GauntletAttempt",
        entityId: attempt.id,
        metadata: { scenarioId: safeScenarioId, correct, xpAwarded }
      }
    });
    return { xpAwarded };
  }, { isolationLevel: "Serializable" });

  if (correct) {
    const badge = await db.badge.findUnique({ where: { key: "gauntlet-first" } });
    if (badge) {
      await db.userBadge.upsert({
        where: { userId_badgeId: { userId: session.user.id, badgeId: badge.id } },
        update: {},
        create: { userId: session.user.id, badgeId: badge.id }
      });
    }
  }

  revalidatePath("/dashboard/student");
  redirect(`/gauntlet?result=${correct ? "correct" : "review"}&xp=${result.xpAwarded}`);
}

export async function submitWinchesterLead(formData: FormData) {
  if (process.env.WINCHESTER_LEADS_ENABLED !== "true") throw new Error("Winchester interest collection is not open yet.");
  // Honeypot: normal users never see or fill this field.
  if (optionalText(formData.get("website"), 200)) redirect("/winchester?submitted=1");

  const session = await getAppSession();
  const email = normalizedEmail(formData.get("email"));
  const contactConsent = formData.get("contactConsent") === "yes";
  if (!contactConsent) throw new Error("Contact consent is required to submit the Winchester interest form.");
  const data = {
    firstName: requiredText(formData.get("firstName"), "First name", 80),
    lastName: requiredText(formData.get("lastName"), "Last name", 80),
    email,
    phone: optionalText(formData.get("phone"), 40),
    experienceLevel: optionalText(formData.get("experienceLevel"), 120),
    targetStart: optionalText(formData.get("targetStart"), 120),
    message: optionalText(formData.get("message"), 2000),
    contactConsent: true,
    consentAt: new Date(),
    privacyVersion: PRIVACY_NOTICE_VERSION
  };

  const recent = await db.winchesterLead.findFirst({
    where: {
      email,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    },
    select: { id: true }
  });

  if (!recent) {
    const lead = await db.winchesterLead.create({
      data: { userId: session?.user.id, ...data }
    });
    await db.auditEvent.create({
      data: {
        actorId: session?.user.id,
        action: "WINCHESTER_LEAD_CREATED",
        entityType: "WinchesterLead",
        entityId: lead.id
      }
    });
  }

  redirect("/winchester?submitted=1");
}

export async function submitCheckrideLead(formData: FormData) {
  if (process.env.CHECKRIDE_LEADS_ENABLED !== "true") throw new Error("Checkride Accelerator interest collection is not open yet.");
  if (optionalText(formData.get("website"), 200)) redirect("/checkride?submitted=1");

  const session = await getAppSession();
  const contactConsent = formData.get("contactConsent") === "yes";
  if (!contactConsent) throw new Error("Contact consent is required to submit the Checkride Accelerator form.");

  await createCheckrideLead({
    userId: session?.user.id,
    firstName: requiredText(formData.get("firstName"), "First name", 80),
    lastName: requiredText(formData.get("lastName"), "Last name", 80),
    email: normalizedEmail(formData.get("email")),
    phone: optionalText(formData.get("phone"), 40),
    certificateLevel: requiredText(formData.get("certificateLevel"), "Certificate level", 120),
    ratingGoal: requiredText(formData.get("ratingGoal"), "Rating goal", 120),
    aircraft: optionalText(formData.get("aircraft"), 120),
    targetCheckride: optionalText(formData.get("targetCheckride"), 120),
    biggestChallenge: optionalText(formData.get("biggestChallenge"), 1200),
    preferredFormat: optionalText(formData.get("preferredFormat"), 120),
    source: optionalText(formData.get("source"), 120),
    campaign: optionalText(formData.get("campaign"), 120),
    contactConsent: true,
    privacyVersion: PRIVACY_NOTICE_VERSION
  });
  redirect("/checkride?submitted=1");
}

export async function reviewLesson(lessonId: string, formData: FormData) {
  const session = await requireRole(Role.CFI, Role.ADMIN);
  const safeLessonId = requiredText(lessonId, "Lesson", 128);
  const decisionText = requiredText(formData.get("decision"), "Decision", 40).toUpperCase();
  if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(decisionText)) throw new Error("Invalid review decision.");
  const decision = decisionText as ReviewDecision;
  const notes = optionalText(formData.get("notes"), 2000);
  await reviewLessonWorkflow({ actor: session.user, lessonId: safeLessonId, decision, notes });
  revalidatePath("/dashboard/cfi");
  revalidatePath("/dashboard/admin");
  revalidatePath("/academy");
}

export async function reviewScenario(scenarioId: string, formData: FormData) {
  const session = await requireRole(Role.CFI, Role.ADMIN);
  const safeScenarioId = requiredText(scenarioId, "Scenario", 128);
  const decisionText = requiredText(formData.get("decision"), "Decision", 40).toUpperCase();
  if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(decisionText)) throw new Error("Invalid review decision.");
  const decision = decisionText as ReviewDecision;
  const notes = optionalText(formData.get("notes"), 2000);
  await reviewScenarioWorkflow({ actor: session.user, scenarioId: safeScenarioId, decision, notes });
  revalidatePath("/dashboard/cfi");
  revalidatePath("/dashboard/admin");
}

export async function publishScenario(scenarioId: string) {
  const session = await requireRole(Role.ADMIN);
  const safeScenarioId = requiredText(scenarioId, "Scenario", 128);
  await publishScenarioWorkflow({ actor: session.user, scenarioId: safeScenarioId });
  revalidatePath("/dashboard/admin");
  revalidatePath("/gauntlet");
}

export async function updateLessonDraft(lessonId: string, formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const safeLessonId = requiredText(lessonId, "Lesson", 128);
  const title = requiredText(formData.get("title"), "Title", 140);
  const summary = requiredText(formData.get("summary"), "Summary", 500);
  const contentMd = requiredText(formData.get("contentMd"), "Lesson content", 30000);
  const sourceNotes = requiredText(formData.get("sourceNotes"), "Source notes", 8000);
  const lesson = await db.lesson.findUnique({ where: { id: safeLessonId } });
  if (!lesson || lesson.status === ContentStatus.RETIRED) throw new Error("Lesson cannot be edited.");

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: safeLessonId },
      data: {
        title, summary, contentMd, sourceNotes,
        status: ContentStatus.DRAFT,
        version: { increment: 1 },
        reviewedAt: null,
        publishedAt: null
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: session.user.id,
        action: "LESSON_DRAFT_UPDATED",
        entityType: "Lesson",
        entityId: safeLessonId,
        metadata: { previousVersion: lesson.version, nextVersion: lesson.version + 1 }
      }
    });
  });
  revalidatePath(`/dashboard/admin/content/${safeLessonId}`);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/cfi");
}

export async function publishLesson(lessonId: string) {
  const session = await requireRole(Role.ADMIN);
  const safeLessonId = requiredText(lessonId, "Lesson", 128);
  await publishLessonWorkflow({ actor: session.user, lessonId: safeLessonId });
  revalidatePath("/dashboard/admin");
  revalidatePath("/academy");
}

export async function updateWinchesterLeadStatus(leadId: string, formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const safeLeadId = requiredText(leadId, "Lead", 128);
  const statusText = requiredText(formData.get("status"), "Lead status", 40).toUpperCase();
  if (!Object.values(LeadStatus).includes(statusText as LeadStatus)) throw new Error("Invalid lead status.");
  const status = statusText as LeadStatus;
  const lead = await db.winchesterLead.findUnique({ where: { id: safeLeadId }, select: { status: true } });
  if (!lead) throw new Error("Lead not found.");
  await db.$transaction(async (tx) => {
    await tx.winchesterLead.update({ where: { id: safeLeadId }, data: { status } });
    await tx.auditEvent.create({
      data: {
        actorId: session.user.id,
        action: "WINCHESTER_LEAD_STATUS_UPDATED",
        entityType: "WinchesterLead",
        entityId: safeLeadId,
        metadata: { previousStatus: lead.status, status }
      }
    });
  });
  revalidatePath("/dashboard/admin");
}

export async function updateCheckrideLeadStatus(leadId: string, formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const safeLeadId = requiredText(leadId, "Lead", 128);
  const statusText = requiredText(formData.get("status"), "Lead status", 40).toUpperCase();
  if (!Object.values(LeadStatus).includes(statusText as LeadStatus)) throw new Error("Invalid lead status.");
  await updateCheckrideLeadStatusWorkflow({
    actor: session.user,
    leadId: safeLeadId,
    status: statusText as LeadStatus
  });
  revalidatePath("/dashboard/admin");
}

export async function assignStudentToCfi(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const cfiId = requiredText(formData.get("cfiId"), "CFI", 128);
  const studentId = requiredText(formData.get("studentId"), "Student", 128);
  const note = optionalText(formData.get("note"), 1000);
  if (cfiId === studentId) throw new Error("A user cannot be assigned to themselves.");
  const [cfi, student] = await Promise.all([
    db.user.findUnique({ where: { id: cfiId }, select: { id: true, role: true } }),
    db.user.findUnique({ where: { id: studentId }, select: { id: true, role: true } })
  ]);
  if (!cfi || cfi.role !== Role.CFI) throw new Error("Selected CFI is not an active CFI account.");
  if (!student || student.role !== Role.STUDENT) throw new Error("Selected student is not a student account.");
  const assignment = await db.cfiStudentAssignment.upsert({
    where: { cfiId_studentId: { cfiId, studentId } },
    update: { status: AssignmentStatus.ACTIVE, note, startedAt: new Date(), endedAt: null },
    create: { cfiId, studentId, status: AssignmentStatus.ACTIVE, note, startedAt: new Date() }
  });
  await db.auditEvent.create({
    data: {
      actorId: session.user.id,
      action: "CFI_STUDENT_ASSIGNED",
      entityType: "CfiStudentAssignment",
      entityId: assignment.id,
      metadata: { cfiId, studentId }
    }
  });
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/cfi");
}

export async function updateAssignmentStatus(assignmentId: string, formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const safeAssignmentId = requiredText(assignmentId, "Assignment", 128);
  const statusText = requiredText(formData.get("status"), "Assignment status", 40).toUpperCase();
  if (!Object.values(AssignmentStatus).includes(statusText as AssignmentStatus)) throw new Error("Invalid assignment status.");
  const status = statusText as AssignmentStatus;
  const existing = await db.cfiStudentAssignment.findUnique({ where: { id: safeAssignmentId }, select: { status: true } });
  if (!existing) throw new Error("Assignment not found.");
  await db.$transaction(async (tx) => {
    await tx.cfiStudentAssignment.update({
      where: { id: safeAssignmentId },
      data: {
        status,
        startedAt: status === AssignmentStatus.ACTIVE ? new Date() : undefined,
        endedAt: status === AssignmentStatus.ENDED ? new Date() : status === AssignmentStatus.ACTIVE ? null : undefined
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: session.user.id,
        action: "CFI_ASSIGNMENT_STATUS_UPDATED",
        entityType: "CfiStudentAssignment",
        entityId: safeAssignmentId,
        metadata: { previousStatus: existing.status, status }
      }
    });
  });
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/cfi");
}


export async function updateScenarioDraft(scenarioId: string, formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const safeScenarioId = requiredText(scenarioId, "Scenario", 128);
  const title = requiredText(formData.get("title"), "Title", 160);
  const prompt = requiredText(formData.get("prompt"), "Prompt", 5000);
  const explanation = requiredText(formData.get("explanation"), "Explanation", 10000);
  const riskCategory = requiredText(formData.get("riskCategory"), "Risk category", 100);
  const correctChoiceKey = requiredText(formData.get("correctChoiceKey"), "Correct choice", 40);
  const difficulty = Number(requiredText(formData.get("difficulty"), "Difficulty", 2));
  const xpValue = Number(requiredText(formData.get("xpValue"), "XP value", 5));
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new Error("Difficulty must be an integer from 1 to 5.");
  if (!Number.isInteger(xpValue) || xpValue < 0 || xpValue > 1000) throw new Error("XP value must be an integer from 0 to 1000.");

  let rawChoices: unknown;
  try {
    rawChoices = JSON.parse(requiredText(formData.get("choicesJson"), "Choices JSON", 20000));
  } catch {
    throw new Error("Choices must be valid JSON.");
  }
  if (!Array.isArray(rawChoices) || rawChoices.length < 3 || rawChoices.length > 8) throw new Error("Provide between 3 and 8 choices.");
  const choices = rawChoices.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Choice ${index + 1} must be an object.`);
    const item = value as { key?: unknown; text?: unknown };
    return { key: requiredText(String(item.key ?? ""), `Choice ${index + 1} key`, 40), text: requiredText(String(item.text ?? ""), `Choice ${index + 1} text`, 600) };
  });
  const keys = choices.map((choice) => choice.key);
  if (new Set(keys).size !== keys.length) throw new Error("Choice keys must be unique.");
  if (!keys.includes(correctChoiceKey)) throw new Error("Correct choice key must match one of the choices.");

  const scenario = await db.gauntletScenario.findUnique({ where: { id: safeScenarioId } });
  if (!scenario || scenario.status === ContentStatus.RETIRED) throw new Error("Scenario cannot be edited.");
  await db.$transaction(async (tx) => {
    await tx.gauntletScenario.update({
      where: { id: safeScenarioId },
      data: {
        title,
        prompt,
        choices,
        correctChoiceKey,
        explanation,
        riskCategory,
        difficulty,
        xpValue,
        status: ContentStatus.DRAFT,
        version: { increment: 1 }
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: session.user.id,
        action: "GAUNTLET_DRAFT_UPDATED",
        entityType: "GauntletScenario",
        entityId: safeScenarioId,
        metadata: { previousVersion: scenario.version, nextVersion: scenario.version + 1 }
      }
    });
  });
  revalidatePath(`/dashboard/admin/scenario/${safeScenarioId}`);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/cfi");
}
