import Link from "next/link";
import { submitCheckrideLead } from "@/lib/actions";
import { isCheckrideCheckoutConfigured } from "@/lib/stripe";

const practiceAreas = [
  "Private Helicopter ACS-area confidence baseline",
  "Rotorcraft systems and aerodynamics oral drills",
  "Weather, airspace, navigation, and regulations",
  "Scenario-based aeronautical decision-making",
  "Radio communication practice and feedback",
  "Weak-area review plan for your next CFI session"
];

export default async function CheckridePage({
  searchParams
}: {
  searchParams: Promise<{ submitted?: string; utm_source?: string; utm_campaign?: string }>;
}) {
  const params = await searchParams;
  const leadCollectionEnabled = process.env.CHECKRIDE_LEADS_ENABLED === "true";
  const paymentsConfigured = isCheckrideCheckoutConfigured();
  const source = String(params.utm_source ?? "direct").slice(0, 120);
  const campaign = String(params.utm_campaign ?? "checkride-accelerator").slice(0, 120);

  return <main className="checkridePage">
    <section className="offerHero">
      <div>
        <span className="badge">PRIVATE HELICOPTER • FOUNDING COHORT</span>
        <div className="kicker offerKicker">AEROSFORGE CHECKRIDE ACCELERATOR</div>
        <h1 className="offerTitle">KNOW WHAT<br/><span>YOU KNOW.</span><br/>FIX WHAT YOU DON&apos;T.</h1>
        <p className="offerLead">A focused readiness program for helicopter students approaching the private-pilot practical test. Practice the oral, communications, and judgment—not memorized confidence.</p>
        <div className="offerActions">
          <a className="button primary" href="#apply">Apply for founding access →</a>
          <a className="button" href="#program">See the program</a>
          <Link className="button" href="/checkride/baseline">Student baseline</Link>
        </div>
        <p className="finePrint muted">No pass guarantee. No FAA certificate or WINGS credit is issued. Flight instruction, endorsements, and practical-test eligibility remain with appropriately authorized instructors and the FAA process.</p>
      </div>
      <aside className="card offerCard">
        <span className="kicker">Founding offer</span>
        <div className="price"><strong>$349</strong><span>planned cohort price</span></div>
        <p>Target format: 90 days of platform access plus structured group checkride-preparation sessions.</p>
        <ul className="cleanList">
          <li>CFI-reviewed material only</li>
          <li>Self-reported ACS confidence baseline and focus map</li>
          <li>Oral and scenario practice</li>
          <li>Founding-member feedback channel</li>
        </ul>
        <div className={`notice ${paymentsConfigured ? "successBox" : "warningBox"}`}><strong>No payment is collected from this public page.</strong> {paymentsConfigured ? "Only qualified applicants receive an Admin-created, amount-locked Stripe Checkout link." : "Payments are not open yet; price and schedule remain subject to final approval."}</div>
      </aside>
    </section>

    <section id="program" className="section">
      <div className="kicker">The product—not the promise</div>
      <h2>One outcome. Six practice systems.</h2>
      <div className="practiceGrid">{practiceAreas.map((area, index) => <article className="card practiceCard" key={area}><span>{String(index + 1).padStart(2, "0")}</span><h3>{area}</h3></article>)}</div>
    </section>

    <section className="section grid2">
      <article className="card">
        <div className="kicker">Best fit</div>
        <h2>Built for an approaching checkride.</h2>
        <p className="muted">You are training for Private Pilot—Rotorcraft Helicopter, already working with a CFI, and want disciplined preparation between lessons.</p>
      </article>
      <article className="card">
        <div className="kicker">Not a fit</div>
        <h2>Not a shortcut to certification.</h2>
        <p className="muted">This is not flight training, an endorsement, an official FAA knowledge test, approved aircraft data, or a replacement for your instructor.</p>
      </article>
    </section>

    <section id="apply" className="section applicationShell">
      <div>
        <div className="kicker">Founding cohort application</div>
        <h2>Tell us where your preparation is breaking down.</h2>
        <p className="muted">We are qualifying the first cohort before accepting money. Applying creates an interest record, not enrollment or a financial obligation.</p>
        {params.submitted === "1" && <p className="notice successBox"><strong>Application received.</strong> Your Checkride Accelerator interest record is in the pipeline.</p>}
      </div>
      {leadCollectionEnabled ? <form className="card leadForm" action={submitCheckrideLead}>
        <div className="formGrid"><label>First name<input name="firstName" autoComplete="given-name" required maxLength={80}/></label><label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80}/></label></div>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
        <label>Phone <span className="muted">(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label>
        <div className="formGrid">
          <label>Current certificate<select name="certificateLevel" defaultValue="Student pilot" required><option>Student pilot</option><option>No certificate yet</option><option>Private pilot—other category</option><option>Commercial pilot—other category</option><option>Other</option></select></label>
          <label>Rating goal<select name="ratingGoal" defaultValue="Private Helicopter" required><option>Private Helicopter</option><option>Private Helicopter Add-On</option><option>Instrument Helicopter</option><option>Commercial Helicopter</option><option>Helicopter CFI</option></select></label>
        </div>
        <div className="formGrid">
          <label>Training aircraft<select name="aircraft" defaultValue="R22"><option>R22</option><option>R44</option><option>Cabri G2</option><option>Schweizer 300</option><option>Other / undecided</option></select></label>
          <label>Target checkride<select name="targetCheckride" defaultValue="Within 90 days"><option>Within 30 days</option><option>Within 60 days</option><option>Within 90 days</option><option>3–6 months</option><option>Not scheduled</option></select></label>
        </div>
        <label>Preferred format<select name="preferredFormat" defaultValue="Hybrid: self-paced + live group"><option>Hybrid: self-paced + live group</option><option>Self-paced platform</option><option>Live small group</option><option>One-on-one mock oral</option></select></label>
        <label>Biggest preparation challenge<textarea name="biggestChallenge" rows={4} maxLength={1200} placeholder="Oral confidence, weather, systems, regulations, radio work…"/></label>
        <input type="hidden" name="source" value={source}/><input type="hidden" name="campaign" value={campaign}/>
        <label className="consent"><input name="contactConsent" value="yes" type="checkbox" required/><span>I agree that AEROSFORGE may contact me about the Checkride Accelerator. This is not enrollment or a purchase. I have reviewed the privacy notice.</span></label>
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        <p className="finePrint">Review the <Link href="/privacy"><u>prelaunch privacy notice</u></Link> before submitting.</p>
        <button className="primary" type="submit">Apply for founding access →</button>
      </form> : <article className="card controlledOffer"><span className="badge">CONTROLLED LAUNCH</span><h2>Applications are not open yet.</h2><p className="muted">The offer is visible for review, but contact collection remains locked until privacy operations and founder follow-up are ready.</p><Link className="button" href="/privacy">Read the prelaunch privacy notice</Link></article>}
    </section>
  </main>;
}
