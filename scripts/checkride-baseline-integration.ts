import "dotenv/config";
import { Role } from "../generated/prisma/client";
import {
  createCheckrideBaseline,
  parseFocusAreas
} from "../lib/checkride-baseline";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Checkride baseline integration runs only with GitHub Actions test identities.");
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
  const [student, cfi] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "cfi.e2e@aerosforge.test" } })
  ]);
  const ratings = { I: 5, II: 4, III: 3, IV: 2, V: 1, VI: 5, VII: 4, VIII: 2, IX: 3, X: 4 };

  await expectRejection(
    () => createCheckrideBaseline({ actor: { id: cfi.id, role: Role.CFI }, ratings }),
    "Only a Student can submit a checkride baseline."
  );
  await expectRejection(
    () => createCheckrideBaseline({ actor: { id: student.id, role: Role.STUDENT }, ratings: { ...ratings, V: 6 } }),
    "Rate Takeoffs, Landings, and Go-Arounds from 1 to 5."
  );

  const first = await createCheckrideBaseline({
    actor: { id: student.id, role: Role.STUDENT },
    ratings,
    reflection: "I want my instructor to probe emergency operations and performance planning."
  });
  const duplicate = await createCheckrideBaseline({ actor: { id: student.id, role: Role.STUDENT }, ratings });
  if (!first.created || duplicate.created || first.id !== duplicate.id) {
    throw new Error("Recent duplicate Checkride baseline was not suppressed.");
  }

  const [stored, auditCount] = await Promise.all([
    db.checkrideBaseline.findUniqueOrThrow({ where: { id: first.id } }),
    db.auditEvent.count({ where: { action: "CHECKRIDE_BASELINE_CREATED", entityId: first.id } })
  ]);
  const focus = parseFocusAreas(stored.focusAreas);
  if (
    stored.standardCode !== "FAA-S-ACS-15" ||
    stored.standardEdition !== "April 2024" ||
    stored.instrumentVersion !== 1 ||
    stored.confidenceTotal !== 33 ||
    focus.map((area) => area.key).join(",") !== "V,IV,VIII" ||
    auditCount !== 1
  ) {
    throw new Error("Checkride baseline scoring, focus selection, or audit history is incorrect.");
  }
  console.log("Student-only ACS self-baseline → validation → duplicate suppression → focus map → audit integration passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
