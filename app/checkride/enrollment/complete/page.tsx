import Link from "next/link";

export default function CheckrideEnrollmentCompletePage() {
  return <main>
    <section className="section narrowPage">
      <span className="badge success">PAYMENT SUBMITTED</span>
      <h1 className="compactHeading">WELCOME TO<br/><span>THE COHORT.</span></h1>
      <div className="card">
        <h2>Confirmation is processing.</h2>
        <p>Stripe has returned you to AEROSFORGE. Enrollment is activated only after our server verifies Stripe&apos;s signed payment event.</p>
        <p className="muted">Keep the receipt Stripe sends you. AEROSFORGE does not treat this page or its URL as proof of payment.</p>
        <Link className="button" href="/sign-in">Continue to sign in</Link>
      </div>
    </section>
  </main>;
}
