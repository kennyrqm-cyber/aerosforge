import Link from "next/link";

export default function CheckrideEnrollmentCanceledPage() {
  return <main>
    <section className="section narrowPage">
      <span className="badge">CHECKOUT CANCELED</span>
      <h1 className="compactHeading">NO CHARGE<br/><span>WAS COMPLETED.</span></h1>
      <div className="card">
        <p>You can return to your secure Stripe Checkout link while it remains active, or contact AEROSFORGE if you need a new invitation.</p>
        <Link className="button" href="/checkride">Return to the Checkride Accelerator</Link>
      </div>
    </section>
  </main>;
}
