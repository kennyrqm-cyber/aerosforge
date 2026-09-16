import Link from "next/link";
import { submitWinchesterLead } from "@/lib/actions";

export default async function WinchesterPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const params = await searchParams;
  const leadCollectionEnabled = process.env.WINCHESTER_LEADS_ENABLED === "true";
  return <main>
    <section className="section grid2">
      <article>
        <div className="kicker">Winchester, Virginia • 2027 pathway</div>
        <h1 className="compactHeading">FROM DIGITAL<br/><span>LEARNING</span><br/>TO THE FLIGHT LINE.</h1>
        <p className="muted">Tell us where you are in your rotorcraft journey. This is an interest pathway—not an enrollment contract, FAA certification, or promise of training availability.</p>
        {params.submitted === "1" && <p className="notice successBox">Interest received. Your pathway record is in the system.</p>}
      </article>
      {leadCollectionEnabled ? <form className="card leadForm" action={submitWinchesterLead}>
        <h2>Join the interest list</h2>
        <div className="formGrid"><label>First name<input name="firstName" required maxLength={80}/></label><label>Last name<input name="lastName" required maxLength={80}/></label></div>
        <label>Email<input name="email" type="email" required maxLength={254}/></label>
        <label>Phone <span className="muted">(optional)</span><input name="phone" type="tel" maxLength={40}/></label>
        <label>Current experience<select name="experienceLevel" defaultValue="Starting from zero"><option>Starting from zero</option><option>Exploring discovery flight</option><option>Student pilot</option><option>Private pilot</option><option>Commercial pilot</option><option>CFI / aviation professional</option></select></label>
        <label>Target start<select name="targetStart" defaultValue="Undecided"><option>Undecided</option><option>Within 3 months</option><option>3–6 months</option><option>6–12 months</option><option>2027</option></select></label>
        <label>What are you trying to accomplish?<textarea name="message" rows={5} maxLength={2000}/></label>
        <label className="consent"><input name="contactConsent" value="yes" type="checkbox" required/><span>I agree that AEROSFORGE may contact me about the Winchester aviation-training pathway. This is not enrollment or a purchase. I have reviewed the privacy notice.</span></label>
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        <p className="finePrint">Read the <Link href="/privacy"><u>prelaunch privacy notice</u></Link> before submitting.</p>
        <button className="primary" type="submit">Submit interest →</button>
        <p className="muted finePrint">Submitting this form creates an AEROSFORGE interest record. It does not reserve a training slot or create a financial obligation.</p>
      </form> : <article className="card"><span className="badge">CONTROLLED LAUNCH</span><h2>Interest collection is not open yet.</h2><p className="muted">The pathway page is live, but applicant collection remains fail-closed until privacy/contact operations are approved and deliberately enabled.</p><Link className="button" href="/privacy">Read the prelaunch privacy notice</Link></article>}
    </section>
  </main>;
}
