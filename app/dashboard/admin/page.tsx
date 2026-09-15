import Link from "next/link";
import { AssignmentStatus, CheckridePaymentStatus, LeadStatus, PrivacyRequestStatus, Role } from "@/generated/prisma/client";
import { SignOutButton } from "@/components/sign-out-button";
import {
  assignStudentToCfi,
  createCheckrideCheckoutSession,
  publishLesson,
  publishScenario,
  updateAssignmentStatus,
  updateCheckrideLeadStatus,
  updatePrivacyRequestStatus,
  updateWinchesterLeadStatus
} from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { isCheckrideCheckoutConfigured } from "@/lib/stripe";

const leadStatuses = Object.values(LeadStatus);
const assignmentStatuses = Object.values(AssignmentStatus);
const privacyRequestStatuses = Object.values(PrivacyRequestStatus);
const terminalLeadStatuses = new Set<LeadStatus>([LeadStatus.ENROLLED, LeadStatus.CLOSED]);
const checkoutEligibleLeadStatuses = new Set<LeadStatus>([LeadStatus.QUALIFIED, LeadStatus.DISCOVERY_SCHEDULED]);
const terminalPrivacyStatuses: PrivacyRequestStatus[] = [PrivacyRequestStatus.COMPLETED, PrivacyRequestStatus.DENIED];

function dateTimeLocalValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : "";
}

export default async function AdminDashboard() {
  const session = await requireRole(Role.ADMIN);
  const now = new Date();
  const paymentsConfigured = isCheckrideCheckoutConfigured();
  const [users, students, cfis, winchesterOpenLeadCount, checkrideOpenLeadCount, checkrideApplicationCount, qualifiedCheckrideLeadCount, enrolledCheckrideLeadCount, paidCheckridePaymentCount, paidCheckrideRevenue, paymentReviewCount, overdueCheckrideLeadCount, unscheduledCheckrideLeadCount, privacyOpenCount, privacyOverdueCount, privacyIdentityPendingCount, privacyRequestRows, draftCount, drafts, draftScenarios, approved, approvedScenarios, auditEvents, winchesterLeadRows, checkrideLeadRows, cfiUsers, studentUsers, assignments] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: Role.STUDENT } }),
    db.user.count({ where: { role: Role.CFI } }),
    db.winchesterLead.count({ where: { status: { not: LeadStatus.CLOSED } } }),
    db.checkrideLead.count({ where: { status: { notIn: [LeadStatus.ENROLLED, LeadStatus.CLOSED] } } }),
    db.checkrideLead.count(),
    db.checkrideLead.count({ where: { qualifiedAt: { not: null } } }),
    db.checkrideLead.count({ where: { enrolledAt: { not: null } } }),
    db.checkridePayment.count({ where: { status: CheckridePaymentStatus.PAID } }),
    db.checkridePayment.aggregate({ where: { status: CheckridePaymentStatus.PAID }, _sum: { amountCents: true } }),
    db.checkridePayment.count({ where: { status: { in: [CheckridePaymentStatus.REVIEW_REQUIRED, CheckridePaymentStatus.DISPUTED] } } }),
    db.checkrideLead.count({
      where: {
        nextFollowUpAt: { lt: now },
        status: { notIn: [LeadStatus.ENROLLED, LeadStatus.CLOSED] }
      }
    }),
    db.checkrideLead.count({
      where: {
        nextFollowUpAt: null,
        contactConsent: true,
        status: { notIn: [LeadStatus.ENROLLED, LeadStatus.CLOSED] }
      }
    }),
    db.privacyRequest.count({ where: { status: { notIn: terminalPrivacyStatuses } } }),
    db.privacyRequest.count({
      where: { dueAt: { lt: now }, status: { notIn: terminalPrivacyStatuses } }
    }),
    db.privacyRequest.count({ where: { status: PrivacyRequestStatus.IDENTITY_PENDING } }),
    db.privacyRequest.findMany({ orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }], take: 50 }),
    db.lesson.count({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } } }),
    db.lesson.findMany({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: { order: "asc" }, take: 12 }),
    db.gauntletScenario.findMany({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: [{ difficulty: "asc" }, { title: "asc" }], take: 12 }),
    db.lesson.findMany({ where: { status: "APPROVED" }, orderBy: { order: "asc" }, take: 20 }),
    db.gauntletScenario.findMany({ where: { status: "APPROVED" }, orderBy: [{ difficulty: "asc" }, { title: "asc" }], take: 20 }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.winchesterLead.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    db.checkrideLead.findMany({
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
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
  const qualificationRate = checkrideApplicationCount === 0 ? 0 : Math.round((qualifiedCheckrideLeadCount / checkrideApplicationCount) * 100);
  const paidRevenue = ((paidCheckrideRevenue._sum.amountCents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

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
          <div className="kicker">Privacy operations</div><h2>Data-rights case queue</h2>
          <p className="muted">Verify identity outside this screen before marking a case VERIFIED. Never request passwords, medical records, government IDs, or certificate images through the public form. Completion records the case decision; it does not automatically erase data.</p>
          <div className="metricRow">
            <div className="metric"><strong>{privacyOpenCount}</strong><span className="label">Open cases</span></div>
            <div className={`metric ${privacyOverdueCount > 0 ? "metricDanger" : ""}`}><strong>{privacyOverdueCount}</strong><span className="label">Past target</span></div>
            <div className="metric"><strong>{privacyIdentityPendingCount}</strong><span className="label">Identity pending</span></div>
          </div>
          {privacyRequestRows.length === 0 ? <div className="card"><p className="muted">No privacy requests recorded.</p></div> : <div className="leadOpsGrid">{privacyRequestRows.map((request) => {
            const terminal = terminalPrivacyStatuses.includes(request.status);
            const overdue = request.dueAt < now && !terminal;
            return <article className={`card leadOpsCard ${overdue ? "overdueLead" : ""}`} key={request.id}>
              <div className="leadOpsHeader">
                <div><span className="badge">{request.requestType}</span><span className="badge">{request.status}</span>{overdue ? <span className="badge danger">RESPONSE TARGET MISSED</span> : null}<h3>{request.firstName} {request.lastName}</h3></div>
                <div className="muted finePrint">Received {request.createdAt.toLocaleString("en-US")}</div>
              </div>
              <div className="leadFacts">
                <div><span className="label">Requester</span><a href={`mailto:${request.email}`}>{request.email}</a></div>
                <div><span className="label">Response target</span><strong>{request.dueAt.toLocaleString("en-US")}</strong></div>
                <div><span className="label">Identity verified</span><strong>{request.identityVerifiedAt?.toLocaleString("en-US") ?? "NO"}</strong></div>
                <div><span className="label">Resolved</span><strong>{request.resolvedAt?.toLocaleString("en-US") ?? "OPEN"}</strong></div>
              </div>
              {request.details ? <p className="leadChallenge"><strong>Request details:</strong> {request.details}</p> : null}
              <p className="finePrint muted">Notice version: {request.privacyVersion}</p>
              <form className="opsForm leadPipelineForm" action={updatePrivacyRequestStatus.bind(null, request.id)}>
                <label>Case status<select name="status" defaultValue={request.status}>{privacyRequestStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label>Restricted handling note<textarea name="internalNote" rows={3} maxLength={2000} defaultValue={request.internalNote ?? ""} placeholder="Verification method, systems searched, action taken, exception, or denial reason"/></label>
                <div className="leadOpsFooter"><span className="finePrint muted">DENIED requires a reason. IN_PROGRESS and COMPLETED require a prior VERIFIED save.</span><button type="submit">Save privacy case</button></div>
              </form>
            </article>;
          })}</div>}
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
          <p className="muted">Applications become payable only after qualification. Checkout is Stripe-hosted, created by an Admin, amount-locked to the approved $349 offer, and fulfilled only by a verified webhook.</p>
          {!paymentsConfigured ? <div className="notice warningBox"><strong>Payments are not open yet.</strong> The Stripe restricted key, webhook secret, approved Price ID, checkout origin, and explicit payment flag must all be configured.</div> : null}
          <div className="metricRow revenueMetrics">
            <div className="metric"><strong>{checkrideApplicationCount}</strong><span className="label">Applications</span></div>
            <div className="metric"><strong>{qualifiedCheckrideLeadCount}</strong><span className="label">Qualified or beyond</span></div>
            <div className="metric"><strong>{qualificationRate}%</strong><span className="label">Application → qualified</span></div>
            <div className="metric"><strong>{enrolledCheckrideLeadCount}</strong><span className="label">Enrolled</span></div>
            <div className="metric"><strong>{paidCheckridePaymentCount}</strong><span className="label">Verified payments</span></div>
            <div className="metric"><strong>{paidRevenue}</strong><span className="label">Confirmed cash</span></div>
            <div className={`metric ${paymentReviewCount > 0 ? "metricDanger" : ""}`}><strong>{paymentReviewCount}</strong><span className="label">Payment review</span></div>
            <div className={`metric ${overdueCheckrideLeadCount > 0 ? "metricDanger" : ""}`}><strong>{overdueCheckrideLeadCount}</strong><span className="label">Overdue follow-ups</span></div>
            <div className={`metric ${unscheduledCheckrideLeadCount > 0 ? "metricDanger" : ""}`}><strong>{unscheduledCheckrideLeadCount}</strong><span className="label">Missing next action</span></div>
          </div>
          {checkrideLeadRows.length === 0 ? <div className="card"><p className="muted">No Checkride Accelerator applications yet.</p></div> : <div className="leadOpsGrid">{checkrideLeadRows.map((lead) => {
            const terminal = terminalLeadStatuses.has(lead.status);
            const overdue = Boolean(lead.nextFollowUpAt && lead.nextFollowUpAt < now && !terminal);
            const unscheduled = lead.contactConsent && !lead.nextFollowUpAt && !terminal;
            const latestPayment = lead.payments[0];
            const checkoutEligible = lead.contactConsent && checkoutEligibleLeadStatuses.has(lead.status) && latestPayment?.status !== CheckridePaymentStatus.REVIEW_REQUIRED;
            const activeCheckout = latestPayment?.status === CheckridePaymentStatus.OPEN && latestPayment.checkoutUrl && latestPayment.expiresAt && latestPayment.expiresAt > now;
            return <article className={`card leadOpsCard ${overdue ? "overdueLead" : ""}`} key={lead.id}>
              <div className="leadOpsHeader">
                <div><span className="badge">{lead.status}</span>{overdue ? <span className="badge danger">FOLLOW-UP OVERDUE</span> : null}{unscheduled ? <span className="badge danger">NEXT ACTION MISSING</span> : null}<h3>{lead.firstName} {lead.lastName}</h3></div>
                <div className="muted finePrint">Applied {lead.createdAt.toLocaleString("en-US")}</div>
              </div>
              <div className="leadFacts">
                <div><span className="label">Contact</span>{lead.contactConsent && lead.consentAt ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : <span>{lead.email}</span>}{lead.phone ? <span>{lead.phone}</span> : null}</div>
                <div><span className="label">Goal</span><strong>{lead.ratingGoal}</strong><span>{lead.certificateLevel} • {lead.aircraft ?? "aircraft not set"}</span></div>
                <div><span className="label">Timing</span><strong>{lead.targetCheckride ?? "—"}</strong><span>{lead.preferredFormat ?? "—"}</span></div>
                <div><span className="label">Acquisition</span><strong>{lead.source ?? "direct"}</strong><span>{lead.campaign ?? "—"}</span></div>
              </div>
              {lead.biggestChallenge ? <p className="leadChallenge"><strong>Preparation challenge:</strong> {lead.biggestChallenge}</p> : null}
              <p className="finePrint muted">Consent: {lead.contactConsent && lead.consentAt ? `YES • ${lead.consentAt.toLocaleString("en-US")}` : "NO — DO NOT CONTACT"} • Notice {lead.privacyVersion ?? "not recorded"}</p>
              <div className="checkoutOps">
                <div><span className="label">Payment</span><strong>{latestPayment?.status ?? "NOT CREATED"}</strong>{latestPayment ? <span>${(latestPayment.amountCents / 100).toFixed(2)} {latestPayment.currency.toUpperCase()} • {latestPayment.createdAt.toLocaleString("en-US")}</span> : <span>Qualify the applicant before creating checkout.</span>}</div>
                {activeCheckout ? <a className="button" href={latestPayment.checkoutUrl!} target="_blank" rel="noreferrer">Open secure checkout ↗</a> : <form action={createCheckrideCheckoutSession.bind(null, lead.id)}><button type="submit" disabled={!paymentsConfigured || !checkoutEligible}>Create $349 checkout</button></form>}
              </div>
              <form className="opsForm leadPipelineForm" action={updateCheckrideLeadStatus.bind(null, lead.id)}>
                <div className="formGrid">
                  <label>Pipeline stage<select name="status" defaultValue={lead.status}>{leadStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <label>Next follow-up <span className="muted">(UTC)</span><input name="nextFollowUpAt" type="datetime-local" defaultValue={dateTimeLocalValue(lead.nextFollowUpAt)}/></label>
                </div>
                <label>Internal follow-up note<textarea name="internalNote" rows={3} maxLength={2000} defaultValue={lead.internalNote ?? ""} placeholder="Outcome, objection, next commitment, or reason for closure"/></label>
                <label className="consent contactCheck"><input name="markContacted" value="yes" type="checkbox" disabled={!lead.contactConsent || !lead.consentAt}/><span>Record that I contacted this applicant now</span></label>
                <div className="leadOpsFooter">
                  <span className="finePrint muted">Last contact: {lead.lastContactedAt?.toLocaleString("en-US") ?? "not recorded"} • Qualified: {lead.qualifiedAt?.toLocaleString("en-US") ?? "not yet"} • Enrolled: {lead.enrolledAt?.toLocaleString("en-US") ?? "not yet"}</span>
                  <button type="submit">Save pipeline</button>
                </div>
              </form>
            </article>;
          })}</div>}
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
