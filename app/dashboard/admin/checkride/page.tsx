import Link from "next/link";
import { CheckrideCohortStatus, CheckrideEnrollmentStatus, CheckridePaymentStatus, Role } from "@/generated/prisma/client";
import { SignOutButton } from "@/components/sign-out-button";
import {
  createCheckrideCohort,
  updateCheckrideCohortStatus,
  updateCheckrideEnrollment
} from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

const cohortStatuses = Object.values(CheckrideCohortStatus);
const enrollmentStatuses = [
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
];
const capacityStatuses = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
]);
const terminalEnrollmentStatuses = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.COMPLETED,
  CheckrideEnrollmentStatus.REFUNDED,
  CheckrideEnrollmentStatus.DISPUTED
]);
const unavailableCohortStatuses = new Set<CheckrideCohortStatus>([
  CheckrideCohortStatus.COMPLETED,
  CheckrideCohortStatus.CANCELED
]);

function dateTimeLocalValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : "";
}

export default async function CheckrideDeliveryDashboard() {
  const session = await requireRole(Role.ADMIN);
  const now = new Date();
  const [cohorts, enrollments, students] = await Promise.all([
    db.checkrideCohort.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        enrollments: { select: { status: true } },
        payments: { select: { status: true, expiresAt: true, paidAt: true, enrollment: { select: { id: true } } } }
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      take: 100
    }),
    db.checkrideEnrollment.findMany({
      include: {
        lead: true,
        payment: true,
        user: { select: { id: true, name: true, email: true } },
        cohort: true
      },
      orderBy: [{ nextActionAt: "asc" }, { createdAt: "asc" }],
      take: 200
    }),
    db.user.findMany({
      where: { role: Role.STUDENT, emailVerified: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ email: "asc" }],
      take: 500
    })
  ]);
  const pending = enrollments.filter((item) => item.status === CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING).length;
  const active = enrollments.filter((item) => item.status === CheckrideEnrollmentStatus.ACTIVE).length;
  const completed = enrollments.filter((item) => item.status === CheckrideEnrollmentStatus.COMPLETED).length;
  const overdue = enrollments.filter((item) => !terminalEnrollmentStatuses.has(item.status) && item.nextActionAt && item.nextActionAt < now).length;
  const availableCohorts = cohorts.filter((item) => !unavailableCohortStatuses.has(item.status));
  const studentsByEmail = new Map(students.map((student) => [student.email.toLowerCase(), student]));

  return <main>
    <div className="dashboardGrid">
      <aside className="card sidebar">
        <span className="badge">OWNER ADMIN</span>
        <h3>{session.user.name ?? session.user.email}</h3>
        <p className="muted">Paid-customer delivery control</p>
        <div className="stack">
          <Link className="button" href="/dashboard/admin">Owner dashboard</Link>
          <Link className="button" href="/checkride">Checkride offer</Link>
          <SignOutButton/>
        </div>
      </aside>
      <section>
        <div className="kicker">Revenue Stage 3</div>
        <h2>Checkride cohort operations</h2>
        <p className="muted">A verified payment creates a delivery record automatically. This queue is the operational source of truth for onboarding, cohort capacity, account linking, service delivery, and adverse-payment lockout.</p>
        <div className="metricRow">
          <div className="metric"><strong>{pending}</strong><span className="label">Awaiting onboarding</span></div>
          <div className="metric"><strong>{active}</strong><span className="label">Active delivery</span></div>
          <div className="metric"><strong>{completed}</strong><span className="label">Completed</span></div>
          <div className={`metric ${overdue > 0 ? "metricDanger" : ""}`}><strong>{overdue}</strong><span className="label">Overdue next actions</span></div>
        </div>

        <div className="section">
          <div className="kicker">Capacity control</div><h2>Create a real cohort</h2>
          <form className="card opsForm" action={createCheckrideCohort}>
            <div className="formGrid">
              <label>Cohort code<input name="code" required maxLength={32} placeholder="PH-2026-01"/></label>
              <label>Name<input name="name" required maxLength={120} placeholder="Private Helicopter Founding Cohort 01"/></label>
              <label>Starts <span className="muted">(UTC)</span><input name="startsAt" type="datetime-local" required/></label>
              <label>Ends <span className="muted">(UTC)</span><input name="endsAt" type="datetime-local" required/></label>
              <label>Capacity<input name="capacity" type="number" min={1} max={50} defaultValue={10} required/></label>
            </div>
            <button className="primary" type="submit">Create scheduled cohort</button>
          </form>
          {cohorts.length === 0 ? <div className="card"><p className="muted">No cohorts created. Do not promise a seat or date until a real cohort exists here.</p></div> : <div className="grid2 cohortGrid">{cohorts.map((cohort) => {
            const occupied = cohort.enrollments.filter((item) => capacityStatuses.has(item.status)).length;
            const held = cohort.payments.filter((item) =>
              item.status === CheckridePaymentStatus.CREATING || item.status === CheckridePaymentStatus.OPEN
              || ((item.status === CheckridePaymentStatus.PAID || item.status === CheckridePaymentStatus.REVIEW_REQUIRED) && Boolean(item.paidAt) && !item.enrollment)
            ).length;
            return <article className="card" key={cohort.id}>
              <span className={`badge ${cohort.status === CheckrideCohortStatus.ACTIVE ? "success" : ""}`}>{cohort.status}</span>
              <h3>{cohort.code} — {cohort.name}</h3>
              <p><strong>{occupied} enrolled • {held} held • {Math.max(0, cohort.capacity - occupied - held)} available</strong></p>
              <p className="muted">Operational owner: {cohort.owner.name || cohort.owner.email}</p>
              <p className="muted">Starts {cohort.startsAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC{cohort.endsAt ? ` • Ends ${cohort.endsAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : ""}</p>
              <form className="inlineForm" action={updateCheckrideCohortStatus.bind(null, cohort.id)}>
                <select name="status" defaultValue={cohort.status}>{cohortStatuses.map((status) => <option key={status}>{status}</option>)}</select>
                <button type="submit">Save status</button>
              </form>
            </article>;
          })}</div>}
        </div>

        <div className="section">
          <div className="kicker">Fulfillment queue</div><h2>Paid enrollments</h2>
          {enrollments.length === 0 ? <div className="card"><p className="muted">No verified paid enrollments yet. Applications and open checkout sessions do not appear here.</p></div> : <div className="leadOpsGrid">{enrollments.map((enrollment) => {
            const matchingStudent = studentsByEmail.get(enrollment.lead.email.toLowerCase());
            const matchingStudents = matchingStudent ? [matchingStudent] : [];
            const overdueAction = Boolean(enrollment.nextActionAt && enrollment.nextActionAt < now && !terminalEnrollmentStatuses.has(enrollment.status));
            const selectableCohorts = availableCohorts.some((cohort) => cohort.id === enrollment.cohortId)
              ? availableCohorts
              : enrollment.cohort ? [enrollment.cohort, ...availableCohorts] : availableCohorts;
            const reservedCohortId = enrollment.payment.cohortId;
            return <article className={`card leadOpsCard ${overdueAction ? "overdueLead" : ""}`} key={enrollment.id}>
              <div className="leadOpsHeader">
                <div><span className="badge">{enrollment.status}</span>{overdueAction ? <span className="badge danger">NEXT ACTION OVERDUE</span> : null}<h3>{enrollment.lead.firstName} {enrollment.lead.lastName}</h3></div>
                <div className="muted finePrint">Paid {enrollment.payment.paidAt?.toLocaleString("en-US") ?? "verification timestamp missing"}</div>
              </div>
              <div className="leadFacts">
                <div><span className="label">Applicant</span><a href={`mailto:${enrollment.lead.email}`}>{enrollment.lead.email}</a><span>{enrollment.lead.ratingGoal}</span></div>
                <div><span className="label">Payment</span><strong>{enrollment.payment.status}</strong><span>${(enrollment.payment.amountCents / 100).toFixed(2)} {enrollment.payment.currency.toUpperCase()}</span></div>
                <div><span className="label">Student account</span><strong>{enrollment.user?.email ?? "NOT LINKED"}</strong><span>{matchingStudents.length === 0 ? "Matching verified account required" : "Email match available"}</span></div>
                <div><span className="label">Cohort</span><strong>{enrollment.cohort?.code ?? "NOT ASSIGNED"}</strong><span>{enrollment.cohort?.name ?? "Capacity not reserved"}</span></div>
              </div>
              <form className="opsForm leadPipelineForm" action={updateCheckrideEnrollment.bind(null, enrollment.id)}>
                <div className="formGrid">
                  <label>Delivery status<select name="status" defaultValue={enrollment.status}>{enrollmentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <label>Next action <span className="muted">(UTC)</span><input name="nextActionAt" type="datetime-local" defaultValue={dateTimeLocalValue(enrollment.nextActionAt)}/></label>
                  <label>Matching Student account<select name="userId" defaultValue={enrollment.userId ?? ""}><option value="">Not linked</option>{matchingStudents.map((student) => <option key={student.id} value={student.id}>{student.name || student.email} — {student.email}</option>)}</select></label>
                  {reservedCohortId ? <label>Reserved cohort<input value={enrollment.cohort?.code ?? reservedCohortId} readOnly/><input name="cohortId" value={reservedCohortId} type="hidden"/></label> : <label>Legacy cohort assignment<select name="cohortId" defaultValue={enrollment.cohortId ?? ""}><option value="">Not assigned</option>{selectableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} — {cohort.name}</option>)}</select></label>}
                </div>
                <label>Restricted delivery note<textarea name="internalNote" rows={3} maxLength={2000} defaultValue={enrollment.internalNote ?? ""} placeholder="Onboarding result, scheduled commitment, delivery blocker, or completion evidence"/></label>
                <div className="leadOpsFooter"><span className="finePrint muted">Open delivery states require a future next action. ACTIVE/COMPLETED require both a matching Student account and an available cohort. Refunds, disputes, and review states are Stripe-owned and stop delivery.</span><button type="submit" disabled={enrollment.payment.status !== "PAID"}>Save delivery record</button></div>
              </form>
            </article>;
          })}</div>}
        </div>
      </section>
    </div>
  </main>;
}
