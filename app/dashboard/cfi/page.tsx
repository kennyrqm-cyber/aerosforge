import { Role } from "@/generated/prisma/client";
import { SignOutButton } from "@/components/sign-out-button";
import { reviewLesson, reviewScenario } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function CfiDashboard() {
  const session = await requireRole(Role.CFI, Role.ADMIN);
  const [assignments, reviewQueue, scenarioQueue] = await Promise.all([
    db.cfiStudentAssignment.findMany({
      where: { cfiId: session.user.id, status: { in: ["PENDING", "ACTIVE"] } },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" }
    }),
    db.lesson.findMany({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
      orderBy: { order: "asc" },
      take: 20
    }),
    db.gauntletScenario.findMany({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      take: 20
    })
  ]);

  return <main>
    <div className="dashboardGrid">
      <aside className="card sidebar"><span className="badge">CFI</span><h3>{session.user.name ?? session.user.email}</h3><p className="muted">Instructor command</p><SignOutButton/></aside>
      <section>
        <div className="kicker">Instructor operations</div><h2>CFI dashboard</h2>
        <div className="metricRow"><div className="metric"><strong>{assignments.length}</strong><span className="label">Assigned students</span></div><div className="metric"><strong>{reviewQueue.length}</strong><span className="label">Review queue</span></div></div>
        <div className="card"><h3>Assigned students</h3>{assignments.length === 0 ? <p className="muted">No active assignments.</p> : <table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td>{item.student.name ?? item.student.email}</td><td>{item.status}</td></tr>)}</tbody></table>}</div>
        <div className="section"><div className="kicker">Content safety gate</div><h2>Review queue</h2><p className="muted">Approval is blocked unless a lesson contains substantive content and source notes. Every decision is recorded.</p><div className="grid2">{reviewQueue.map((lesson) => <article className="card" key={lesson.id}><span className="badge">{lesson.status}</span><h3>{String(lesson.order).padStart(2,"0")} — {lesson.title}</h3><p>{lesson.summary}</p><p className="muted">Version {lesson.version} • Content: {lesson.contentMd ? `${lesson.contentMd.length} chars` : "missing"} • Sources: {lesson.sourceNotes ? "present" : "missing"}</p><details><summary>Read lesson and source notes</summary><div className="lessonBody">{lesson.contentMd ?? "No lesson content yet."}</div><h4>Source notes</h4><div className="sourceNotes">{lesson.sourceNotes ?? "No source notes yet."}</div></details><form className="reviewForm" action={reviewLesson.bind(null, lesson.id)}><label>Decision<select name="decision" defaultValue="CHANGES_REQUESTED">{session.user.role === Role.CFI && <option value="APPROVED">Approve</option>}<option value="CHANGES_REQUESTED">Request changes</option><option value="REJECTED">Reject</option></select></label><label>Review notes<textarea name="notes" rows={4} maxLength={2000}/></label><button type="submit">Record review</button></form></article>)}</div></div>
      <div className="section"><div className="kicker">Gauntlet safety gate</div><h2>Scenario review queue</h2><div className="grid2">{scenarioQueue.map((scenario) => <article className="card" key={scenario.id}><span className="badge">{scenario.status}</span><h3>{scenario.title}</h3><p>{scenario.prompt}</p><p className="muted">Version {scenario.version} • Risk: {scenario.riskCategory} • Difficulty {scenario.difficulty}</p><details><summary>Read answer key and explanation</summary><p><b>Correct choice:</b> {scenario.correctChoiceKey}</p><div className="sourceNotes">{scenario.explanation}</div><pre className="jsonPreview">{JSON.stringify(scenario.choices, null, 2)}</pre></details><form className="reviewForm" action={reviewScenario.bind(null, scenario.id)}><label>Decision<select name="decision" defaultValue="CHANGES_REQUESTED">{session.user.role === Role.CFI && <option value="APPROVED">Approve</option>}<option value="CHANGES_REQUESTED">Request changes</option><option value="REJECTED">Reject</option></select></label><label>Review notes<textarea name="notes" rows={4} maxLength={2000}/></label><button type="submit">Record scenario review</button></form></article>)}</div></div></section>
    </div>
  </main>;
}
