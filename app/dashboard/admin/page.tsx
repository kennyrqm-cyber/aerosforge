import Link from "next/link";
import { AssignmentStatus, LeadStatus, Role } from "@/generated/prisma/client";
import { SignOutButton } from "@/components/sign-out-button";
import {
  assignStudentToCfi,
  publishLesson,
  publishScenario,
  updateAssignmentStatus,
  updateCheckrideLeadStatus,
  updateWinchesterLeadStatus
} from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

const leadStatuses = Object.values(LeadStatus);
const assignmentStatuses = Object.values(AssignmentStatus);

export default async function AdminDashboard() {
  const session = await requireRole(Role.ADMIN);
  const [users, students, cfis, winchesterOpenLeadCount, checkrideOpenLeadCount, draftCount, drafts, draftScenarios, approved, approvedScenarios, auditEvents, winchesterLeadRows, checkrideLeadRows, cfiUsers, studentUsers, assignments] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: Role.STUDENT } }),
    db.user.count({ where: { role: Role.CFI } }),
    db.winchesterLead.count({ where: { status: { not: LeadStatus.CLOSED } } }),
    db.checkrideLead.count({ where: { status: { not: LeadStatus.CLOSED } } }),
    db.lesson.count({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } } }),
    db.lesson.findMany({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: { order: "asc" }, take: 12 }),
    db.gauntletScenario.findMany({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: [{ difficulty: "asc" }, { title: "asc" }], take: 12 }),
    db.lesson.findMany({ where: { status: "APPROVED" }, orderBy: { order: "asc" }, take: 20 }),
    db.gauntletScenario.findMany({ where: { status: "APPROVED" }, orderBy: [{ difficulty: "asc" }, { title: "asc" }], take: 20 }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.winchesterLead.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    db.checkrideLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.findMany({ where: { role: Role.CFI }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 100 }),
    db.user.findMany({ where: { role: Role.STUDENT }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 200 }),
    db.cfiStudentAssignment.findMany({
      include: {
        cfi: { select: { name: true, email: true } },
        student: { select: { name: true, email: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 30
    })
  ]);

  return <main>
    <div className="dashboardGrid">
      <aside className="card sidebar">
        <span className="badge">OWNER ADMIN</span>
        <h3>{session.user.name ?? session.user.email}</h3>
        <p className="muted">AEROSFORGE ONE command</p>
        <div className="stack">
          <Link className="button" href="/dashboard/cfi">Open CFI review queue</Link>
          <Link className="button" href="/checkride">Checkride offer</Link>
          <Link className="button" href="/winchester">Winchester pathway</Link>
          <Link className="button" href="/privacy">Privacy notice</Link>
          <SignOutButton/>
        </div>
      </aside>
      <section>
        <div className="kicker">Platform operations</div>
        <h2>Owner dashboard</h2>
        <div className="metricRow">
          <div className="metric"><strong>{users}</strong><span className="label">Users</span></div>
          <div className="metric"><strong>{students}</strong><span className="label">Students</span></div>
          <div className="metric"><strong>{cfis}</strong><span className="label">CFIs</span></div>
          <div className="metric"><strong>{checkrideOpenLeadCount}</strong><span className="label">Open checkride leads</span></div>
        </div>
        <div className="grid2">
          <div className="card"><h3>Content gate</h3><p><strong>{draftCount}</strong> lessons are draft/in review.</p><p className="muted">Student pages expose PUBLISHED content only.</p></div>
          <div className="card"><h3>Independent review</h3><p>Publication requires an approval from a current CFI other than the publishing admin.</p><p className="muted">Privileged operations emit audit events.</p></div>
        </div>

        <div className="section">
          <div className="kicker">Instructor operations</div><h2>Assign students to CFIs</h2>
          <form className="card opsForm" action={assignStudentToCfi}>
            <div className="formGrid">
              <label>CFI<select name="cfiId" required defaultValue=""><option value="" disabled>Select CFI</option>{cfiUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email} — {user.email}</option>)}</select></label>
              <label>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select student</option>{studentUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email} — {user.email}</option>)}</select></label>
            </div>
            <label>Assignment note <span className="muted">(optional)</span><textarea name="note" rows={3} maxLength={1000}/></label>
            <button className="primary" type="submit" disabled={cfiUsers.length === 0 || studentUsers.length === 0}>Activate assignment</button>
          </form>
          <div className="card tableWrap">
            <table><thead><tr><th>CFI</th><th>Student</th><th>Status</th><th>Change</th></tr></thead><tbody>{assignments.length === 0 ? <tr><td colSpan={4} className="muted">No assignments yet.</td></tr> : assignments.map((item) => <tr key={item.id}><td>{item.cfi.name || item.cfi.email}</td><td>{item.student.name || item.student.email}</td><td>{item.status}</td><td><form className="inlineForm" action={updateAssignmentStatus.bind(null, item.id)}><select name="status" defaultValue={item.status}>{assignmentStatuses.map((status) => <option key={status}>{status}</option>)}</select><button type="submit">Save</button></form></td></tr>)}</tbody></table>
          </div>
        </div>

        <div className="section">
          <div className="kicker">First revenue pipeline</div><h2>Checkride Accelerator applications</h2>
          <p className="muted">These are qualified-interest records—not enrollments or payments. Contact only applicants with recorded consent.</p>
          <div className="card tableWrap">
            <table><thead><tr><th>Applicant</th><th>Goal</th><th>Timing</th><th>Acquisition</th><th>Consent</th><th>Status</th></tr></thead><tbody>{checkrideLeadRows.length === 0 ? <tr><td colSpan={6} className="muted">No Checkride Accelerator applications yet.</td></tr> : checkrideLeadRows.map((lead) => <tr key={lead.id}><td><strong>{lead.firstName} {lead.lastName}</strong><br/><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? <><br/><span className="muted">{lead.phone}</span></> : null}</td><td>{lead.ratingGoal}<br/><span className="muted">{lead.certificateLevel} • {lead.aircraft ?? "aircraft not set"}</span></td><td>{lead.targetCheckride ?? "—"}<br/><span className="muted">{lead.preferredFormat ?? "—"}</span></td><td>{lead.source ?? "direct"}<br/><span className="muted">{lead.campaign ?? "—"}</span></td><td>{lead.contactConsent && lead.consentAt ? <span className="badge success">YES</span> : <span className="badge danger">NO</span>}<br/><span className="muted finePrint">{lead.privacyVersion ?? "no version"}</span></td><td><form className="inlineForm" action={updateCheckrideLeadStatus.bind(null, lead.id)}><select name="status" defaultValue={lead.status}>{leadStatuses.map((status) => <option key={status}>{status}</option>)}</select><button type="submit">Save</button></form></td></tr>)}</tbody></table>
          </div>
        </div>

        <div className="section">
          <div className="kicker">Winchester pipeline</div><h2>Lead operations</h2>
          <p className="muted"><strong>{winchesterOpenLeadCount}</strong> open Winchester leads. Contact only records that carry explicit consent. Status changes are audited.</p>
          <div className="card tableWrap">
            <table><thead><tr><th>Lead</th><th>Path</th><th>Consent</th><th>Created</th><th>Status</th></tr></thead><tbody>{winchesterLeadRows.length === 0 ? <tr><td colSpan={5} className="muted">No leads yet.</td></tr> : winchesterLeadRows.map((lead) => <tr key={lead.id}><td><strong>{lead.firstName} {lead.lastName}</strong><br/><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? <><br/><span className="muted">{lead.phone}</span></> : null}</td><td>{lead.experienceLevel ?? "—"}<br/><span className="muted">{lead.targetStart ?? "—"}</span></td><td>{lead.contactConsent && lead.consentAt ? <span className="badge success">YES</span> : <span className="badge danger">NO</span>}<br/><span className="muted finePrint">{lead.privacyVersion ?? "no version"}</span></td><td>{lead.createdAt.toLocaleDateString("en-US")}</td><td><form className="inlineForm" action={updateWinchesterLeadStatus.bind(null, lead.id)}><select name="status" defaultValue={lead.status}>{leadStatuses.map((status) => <option key={status}>{status}</option>)}</select><button type="submit">Save</button></form></td></tr>)}</tbody></table>
          </div>
        </div>

        <div className="section">
          <div className="kicker">Draft workshop</div><h2>Edit content before review</h2>
          <div className="grid2">{drafts.map((lesson) => <article className="card" key={lesson.id}><span className="badge">{lesson.status}</span><h3>{String(lesson.order).padStart(2,"0")} — {lesson.title}</h3><p>{lesson.summary}</p><Link className="button" href={`/dashboard/admin/content/${lesson.id}`}>Open editor</Link></article>)}</div>
        </div>

        <div className="section">
          <div className="kicker">Gauntlet draft workshop</div><h2>Edit scenarios before CFI review</h2>
          {draftScenarios.length === 0 ? <div className="card"><p className="muted">No draft scenarios.</p></div> : <div className="grid2">{draftScenarios.map((scenario) => <article className="card" key={scenario.id}><span className="badge">{scenario.status}</span><h3>{scenario.title}</h3><p>{scenario.prompt}</p><p className="muted">Version {scenario.version} • {scenario.riskCategory}</p><Link className="button" href={`/dashboard/admin/scenario/${scenario.id}`}>Open scenario editor</Link></article>)}</div>}
        </div>

        <div className="section">
          <div className="kicker">Lesson publication gate</div><h2>Approved lessons awaiting publication</h2>
          <p className="muted">Publish will fail unless a different current CFI supplied an APPROVED review.</p>
          {approved.length === 0 ? <div className="card"><p className="muted">Nothing is awaiting publication.</p></div> : <div className="grid2">{approved.map((lesson) => <article className="card" key={lesson.id}><span className="badge success">APPROVED</span><h3>{String(lesson.order).padStart(2,"0")} — {lesson.title}</h3><p>{lesson.summary}</p><p className="muted">Version {lesson.version}</p><form action={publishLesson.bind(null, lesson.id)}><button className="primary" type="submit">Publish independently reviewed lesson</button></form></article>)}</div>}
        </div>

        <div className="section">
          <div className="kicker">Gauntlet publication gate</div><h2>Approved scenarios awaiting publication</h2>
          <p className="muted">Scenarios use the same independent CFI approval requirement.</p>
          {approvedScenarios.length === 0 ? <div className="card"><p className="muted">Nothing is awaiting publication.</p></div> : <div className="grid2">{approvedScenarios.map((scenario) => <article className="card" key={scenario.id}><span className="badge success">APPROVED</span><h3>{scenario.title}</h3><p>{scenario.prompt}</p><p className="muted">Version {scenario.version}</p><form action={publishScenario.bind(null, scenario.id)}><button className="primary" type="submit">Publish independently reviewed scenario</button></form></article>)}</div>}
        </div>

        <div className="section">
          <div className="kicker">Recent audit events</div><h2>Privileged activity</h2>
          <div className="card tableWrap"><table><thead><tr><th>When</th><th>Action</th><th>Entity</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td>{event.createdAt.toLocaleString("en-US")}</td><td>{event.action}</td><td>{event.entityType}{event.entityId ? ` / ${event.entityId}` : ""}</td></tr>)}</tbody></table></div>
        </div>
      </section>
    </div>
  </main>;
}
