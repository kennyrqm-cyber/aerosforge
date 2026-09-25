import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { updateScenarioDraft } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function ScenarioEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.ADMIN);
  const { id } = await params;
  const scenario = await db.gauntletScenario.findUnique({ where: { id } });
  if (!scenario) notFound();
  const choicesJson = JSON.stringify(scenario.choices, null, 2);
  return <main>
    <section className="section">
      <Link className="button" href="/dashboard/admin">← Admin dashboard</Link>
      <div className="kicker">Gauntlet draft workshop</div>
      <h2>{scenario.title}</h2>
      <p className="muted">Current version {scenario.version} • {scenario.status}. Saving creates a new DRAFT version and any prior approval cannot authorize the new version.</p>
      <form className="card editorForm" action={updateScenarioDraft.bind(null, scenario.id)}>
        <label>Title<input name="title" defaultValue={scenario.title} required maxLength={160}/></label>
        <label>Prompt<textarea name="prompt" defaultValue={scenario.prompt} rows={6} required maxLength={5000}/></label>
        <label>Choices JSON<textarea className="codeField" name="choicesJson" defaultValue={choicesJson} rows={14} required maxLength={20000}/></label>
        <div className="formGrid"><label>Correct choice key<input name="correctChoiceKey" defaultValue={scenario.correctChoiceKey} required maxLength={40}/></label><label>Risk category<input name="riskCategory" defaultValue={scenario.riskCategory} required maxLength={100}/></label></div>
        <div className="formGrid"><label>Difficulty 1–5<input name="difficulty" type="number" min={1} max={5} step={1} defaultValue={scenario.difficulty} required/></label><label>XP value<input name="xpValue" type="number" min={0} max={1000} step={1} defaultValue={scenario.xpValue} required/></label></div>
        <label>Explanation<textarea name="explanation" defaultValue={scenario.explanation} rows={8} required maxLength={10000}/></label>
        <button className="primary" type="submit">Save as new draft version</button>
      </form>
    </section>
  </main>;
}
