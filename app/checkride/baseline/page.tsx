import Link from "next/link";
import { Role } from "@/generated/prisma/client";
import { submitCheckrideBaseline } from "@/lib/actions";
import {
  baselineAverage,
  CHECKRIDE_BASELINE_AREAS,
  CHECKRIDE_BASELINE_STANDARD,
  parseFocusAreas
} from "@/lib/checkride-baseline";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

const scaleLabels = [
  "Need instruction",
  "Major gaps",
  "Developing",
  "Mostly confident",
  "Ready to discuss with my CFI"
];

export default async function CheckrideBaselinePage({
  searchParams
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await requireRole(Role.STUDENT);
  const params = await searchParams;
  const latest = await db.checkrideBaseline.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" }
  });
  const focusAreas = parseFocusAreas(latest?.focusAreas);

  return <main>
    <section className="section baselinePage">
      <div className="kicker">Checkride Accelerator • Study baseline</div>
      <h1 className="compactHeading">FIND THE<br/><span>WEAK SPOTS.</span></h1>
      <p className="offerLead">Rate your present confidence across the ten Areas of Operation in the current Private Pilot—Rotorcraft Helicopter ACS. AEROSFORGE turns that reflection into a starting conversation with your CFI.</p>
      <div className="notice warningBox"><strong>This is not an exam or readiness score.</strong> It is a self-reported study-planning tool. It does not evaluate knowledge, risk management, flight skill, eligibility, endorsement status, or likelihood of passing a practical test.</div>

      {params.submitted === "1" && latest ? <section className="card baselineResult" aria-live="polite">
        <span className="badge success">BASELINE RECORDED</span>
        <h2>Your starting map</h2>
        <p><strong className="baselineAverage">{baselineAverage(latest.confidenceTotal).toFixed(1)} / 5</strong> self-reported average across ten ACS areas.</p>
        <div className="grid baselineFocusGrid">{focusAreas.map((area) => <article key={area.key} className="baselineFocus"><span>Area {area.key}</span><strong>{area.title}</strong><small>Self-rating: {area.rating} / 5</small></article>)}</div>
        <p className="muted">Bring these focus areas to your CFI. A lower rating is useful information—not a failure.</p>
      </section> : latest ? <p className="notice successBox">Your latest baseline was recorded {latest.createdAt.toLocaleDateString("en-US")}. Submit another after meaningful study or instructor feedback—not just to chase a higher number.</p> : null}

      <section className="section applicationShell">
        <div>
          <div className="kicker">Standard reference</div>
          <h2>{CHECKRIDE_BASELINE_STANDARD.code}</h2>
          <p>{CHECKRIDE_BASELINE_STANDARD.title}</p>
          <p className="muted">{CHECKRIDE_BASELINE_STANDARD.edition} edition • Effective {CHECKRIDE_BASELINE_STANDARD.effective} • Source checked {CHECKRIDE_BASELINE_STANDARD.verifiedOn}</p>
          <p><a className="button" href={CHECKRIDE_BASELINE_STANDARD.url} target="_blank" rel="noreferrer">Open the official FAA ACS ↗</a></p>
          <p className="finePrint muted">Always confirm the current standard and applicable tasks directly with the FAA, your instructor, and evaluator.</p>
        </div>
        <form className="card baselineForm" action={submitCheckrideBaseline}>
          <p className="muted">Choose the statement closest to your confidence today. Every area is required.</p>
          {CHECKRIDE_BASELINE_AREAS.map((area) => <fieldset className="baselineArea" key={area.key}>
            <legend><span>Area {area.key}</span>{area.title}</legend>
            <div className="baselineScale">{scaleLabels.map((label, index) => {
              const value = index + 1;
              return <label key={value}><input type="radio" name={`area_${area.key}`} value={value} required/><strong>{value}</strong><span>{label}</span></label>;
            })}</div>
          </fieldset>)}
          <label>What do you most want your CFI to help you improve? <span className="muted">(optional)</span><textarea name="reflection" rows={4} maxLength={1200}/></label>
          <button className="primary" type="submit">Build my study baseline →</button>
        </form>
      </section>
      <p><Link className="button" href="/dashboard/student">← Return to Mission Control</Link></p>
    </section>
  </main>;
}
