import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const CHECKRIDE_BASELINE_STANDARD = {
  code: "FAA-S-ACS-15",
  title: "Private Pilot for Rotorcraft Category Helicopter Rating",
  edition: "April 2024",
  effective: "May 31, 2024",
  verifiedOn: "September 14, 2026",
  url: "https://www.faa.gov/training_testing/testing/acs/private_helicopter_acs_15.pdf"
} as const;

export const CHECKRIDE_BASELINE_AREAS = [
  { key: "I", title: "Preflight Preparation" },
  { key: "II", title: "Preflight Procedures" },
  { key: "III", title: "Airport and Heliport Operations" },
  { key: "IV", title: "Hovering Maneuvers" },
  { key: "V", title: "Takeoffs, Landings, and Go-Arounds" },
  { key: "VI", title: "Performance Maneuvers" },
  { key: "VII", title: "Navigation" },
  { key: "VIII", title: "Emergency Operations" },
  { key: "IX", title: "Night Operations" },
  { key: "X", title: "Postflight Procedures" }
] as const;

export type BaselineFocusArea = {
  key: string;
  title: string;
  rating: number;
};

export function baselineAverage(confidenceTotal: number) {
  return confidenceTotal / CHECKRIDE_BASELINE_AREAS.length;
}

export function parseFocusAreas(value: unknown): BaselineFocusArea[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BaselineFocusArea => {
    if (!item || typeof item !== "object") return false;
    const value = item as Partial<BaselineFocusArea>;
    return typeof value.key === "string" && typeof value.title === "string" && Number.isInteger(value.rating);
  });
}

export async function createCheckrideBaseline(input: {
  actor: { id: string; role: Role };
  ratings: Record<string, unknown>;
  reflection?: string | null;
}) {
  if (input.actor.role !== Role.STUDENT) throw new Error("Only a Student can submit a checkride baseline.");
  const ratings: Record<string, number> = {};
  for (const area of CHECKRIDE_BASELINE_AREAS) {
    const rating = Number(input.ratings[area.key]);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error(`Rate ${area.title} from 1 to 5.`);
    }
    ratings[area.key] = rating;
  }
  const reflection = input.reflection?.trim() || null;
  if (reflection && reflection.length > 1200) throw new Error("Baseline reflection is too long.");

  const recent = await db.checkrideBaseline.findFirst({
    where: {
      userId: input.actor.id,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (recent) return { id: recent.id, created: false };

  const confidenceTotal = Object.values(ratings).reduce((sum, value) => sum + value, 0);
  const focusAreas = CHECKRIDE_BASELINE_AREAS
    .map((area) => ({ ...area, rating: ratings[area.key] }))
    .sort((left, right) => left.rating - right.rating)
    .slice(0, 3);

  const baseline = await db.$transaction(async (tx) => {
    const created = await tx.checkrideBaseline.create({
      data: {
        userId: input.actor.id,
        standardCode: CHECKRIDE_BASELINE_STANDARD.code,
        standardEdition: CHECKRIDE_BASELINE_STANDARD.edition,
        instrumentVersion: 1,
        ratings,
        confidenceTotal,
        focusAreas,
        reflection
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_BASELINE_CREATED",
        entityType: "CheckrideBaseline",
        entityId: created.id,
        metadata: {
          standardCode: CHECKRIDE_BASELINE_STANDARD.code,
          standardEdition: CHECKRIDE_BASELINE_STANDARD.edition,
          instrumentVersion: 1,
          selfReportedAverage: baselineAverage(confidenceTotal),
          focusAreaKeys: focusAreas.map((area) => area.key)
        }
      }
    });
    return created;
  });
  return { id: baseline.id, created: true };
}
