import Link from "next/link";
import { ProgressStatus, Role } from "@/generated/prisma/client";
import { SignOutButton } from "@/components/sign-out-button";
import { baselineAverage, parseFocusAreas } from "@/lib/checkride-baseline";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function StudentDashboard() {
  const session = await requireRole(Role.STUDENT);
  const [progress, badgeCount, attempts, lessonCount, latestBaseline] = await Promise.all([
    db.lessonProgress.findMany({
      where: { userId: session.user.id },
      include: { lesson: true },
      orderBy: { lesson: { order: "asc" } }
    }),
    db.userBadge.count({ where: { userId: session.user.id } }),
    db.gauntletAttempt.findMany({ where: { userId: session.user.id }, select: { xpAwarded: true } }),
    db.lesson.count({ where: { status: "PUBLISHED" } }),
    db.checkrideBaseline.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } })
  ]);

  const completed = progress.filter((item) => item.status === ProgressStatus.COMPLETED);
  const lessonXp = progress.reduce((sum, item) => sum + item.xpAwarded, 0);
  const gauntletXp = attempts.reduce((sum, item) => sum + item.xpAwarded, 0);
  const xp = lessonXp + gauntletXp;
  const level = Math.max(1, Math.min(10, Math.floor(xp / 1000) + 1));
  const baselineFocusAreas = parseFocusAreas(latestBaseline?.focusAreas);

  return <main>
    <div className="dashboardGrid">
      <aside className="card sidebar">
        <span className="badge">STUDENT</span>
        <h3>{session.user.name ?? session.user.email}</h3>
        <p className="muted">Pilot Passport • Level {level}</p>
        <div className="stack"><Link className="button" href="/academy">Academy</Link><Link className="button" href="/gauntlet">The Gauntlet</Link><Link className="button" href="/winchester">Winchester 2027</Link><SignOutButton/></div>
      </aside>
      <section>
        <div className="kicker">Mission Control</div>
        <h2>Student dashboard</h2>
        <div className="metricRow">
          <div className="metric"><strong>{xp}</strong><span className="label">Total XP</span></div>
          <div className="metric"><strong>{completed.length}</strong><span className="label">Lessons complete</span></div>
          <div className="metric"><strong>{badgeCount}</strong><span className="label">Badges</span></div>
          <div className="metric"><strong>{attempts.length}</strong><span className="label">Gauntlet attempts</span></div>
        </div>
        <div className="grid2">
          <div className="card"><h3>Checkride Baseline</h3>{latestBaseline ? <><p><strong>{baselineAverage(latestBaseline.confidenceTotal).toFixed(1)} / 5</strong> self-reported average</p><p className="muted">Focus: {baselineFocusAreas.map((area) => area.title).join(" • ")}</p></> : <p className="muted">Create an ACS-area confidence map to guide your next CFI conversation.</p>}<Link className="button primary" href="/checkride/baseline">{latestBaseline ? "Update baseline" : "Start baseline"}</Link></div>
          <div className="card"><h3>Academy</h3><p className="muted">{lessonCount === 0 ? "No instructor-approved lessons are published yet. Draft content remains protected from students." : `${lessonCount} published lessons are available.`}</p><Link className="button primary" href="/academy">Open Academy</Link></div>
          <div className="card"><h3>The Gauntlet</h3><p className="muted">Practice risk management and decision-making. XP is awarded only once per scenario for the first correct completion.</p><Link className="button" href="/gauntlet">Enter Gauntlet</Link></div>
        </div>
      </section>
    </div>
  </main>;
}
