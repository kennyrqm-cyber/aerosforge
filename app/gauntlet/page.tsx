import Link from "next/link";
import { ContentStatus, Role } from "@/generated/prisma/client";
import { submitGauntletAttempt } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

type Choice = { key: string; text: string };

export default async function GauntletPage({ searchParams }: { searchParams: Promise<{ result?: string; xp?: string }> }) {
  await requireRole(Role.STUDENT);
  const params = await searchParams;
  const scenarios = await db.gauntletScenario.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }]
  });

  return <main>
    <section className="section">
      <div className="kicker">The Gauntlet</div>
      <h2>Make the call before the situation makes it for you.</h2>
      <p className="muted">Scenario practice supports aeronautical decision-making. It does not replace aircraft-specific procedures, approved manuals, or qualified flight instruction.</p>
      {params.result === "correct" && <p className="notice successBox">Strong decision. {Number(params.xp) > 0 ? `First correct completion earned ${params.xp} XP.` : "You already earned XP for this scenario; the repeat still counts as practice."}</p>}
      {params.result === "review" && <p className="notice warningBox">Review the risk picture and try again. No XP was awarded.</p>}
      <div className="grid2">
        {scenarios.length === 0 ? <article className="card"><h3>Scenario gate active</h3><p className="muted">No Gauntlet scenarios have cleared instructor review yet.</p></article> : scenarios.map((scenario) => {
          const choices: Choice[] = (Array.isArray(scenario.choices) ? scenario.choices : []).flatMap((item) => {
            if (!item || typeof item !== "object" || !("key" in item) || !("text" in item)) return [];
            return [{ key: String((item as { key: unknown }).key), text: String((item as { text: unknown }).text) }];
          });
          return <article className="card" key={scenario.id}>
            <span className="badge">{scenario.riskCategory} • Level {scenario.difficulty}</span>
            <h3>{scenario.title}</h3>
            <p>{scenario.prompt}</p>
            <form action={submitGauntletAttempt.bind(null, scenario.id)}>
              <fieldset className="choiceFieldset">
                <legend className="muted">Choose the strongest response</legend>
                {choices.map((choice) => <label className="choice" key={choice.key}><input required type="radio" name="choice" value={choice.key}/><span><b>{choice.key}.</b> {choice.text}</span></label>)}
              </fieldset>
              <button className="primary" type="submit">Commit decision</button>
            </form>
          </article>;
        })}
      </div>
      <p style={{marginTop:24}}><Link className="button" href="/dashboard/student">← Mission Control</Link></p>
    </section>
  </main>;
}
