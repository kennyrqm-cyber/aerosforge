import Link from "next/link";

const pillars = [
  ["Academy", "Structured vertical-flight lessons behind a real review/publish gate.", "/academy"],
  ["Pilot Passport", "Persistent XP, badges, progress, and professional-development milestones.", "/dashboard"],
  ["The Gauntlet", "Scenario-based decision practice with auditable attempts and first-completion XP.", "/gauntlet"],
  ["Rotor Coach", "AI-assisted study remains behind the next safety-and-source implementation gate.", "/dashboard"],
  ["CFI Network", "Instructor review, student assignment, content governance, and progress visibility.", "/dashboard"],
  ["Winchester 2027", "A consent-based funnel from free learning to future discovery-flight and training conversations.", "/winchester"]
] as const;

export default function Home() {
  return <main>
    <section className="hero">
      <div>
        <div className="kicker">Private Helicopter • Checkride Readiness</div>
        <h1>STOP HOPING.<br/><span>START PROVING</span><br/>YOU&apos;RE READY.</h1>
        <p className="muted" style={{fontSize:18}}>AEROSFORGE combines structured study, oral preparation, radio practice, and decision scenarios for helicopter students approaching the practical test.</p>
        <div className="offerActions"><Link className="button primary" href="/checkride">Explore the Accelerator →</Link><Link className="button" href="/sign-in">Member sign in</Link></div>
      </div>
      <div className="heroCard"><span className="badge">FOUNDING COHORT</span><p className="muted">PRIVATE PILOT • ROTORCRAFT HELICOPTER</p><strong>CHECKRIDE<br/><span>ACCELERATOR</span></strong><p>Practice the oral, identify weak areas, sharpen communications, and bring better questions to your CFI.</p><Link className="button primary" href="/checkride">See founding access</Link></div>
    </section>
    <section className="section grid2"><article className="card"><div className="kicker">Brutally focused</div><h2>One urgent outcome first.</h2><p className="muted">The first commercial wedge is helicopter checkride preparation. Broader FlightOps, marketplace, and operator products follow evidence—not enthusiasm.</p><Link className="button primary" href="/checkride">Review the first offer</Link></article><article className="card"><div className="kicker">Safety boundary</div><h2>Publication requires review.</h2><p className="muted">Students see only content approved by an independent current CFI and published by a separate Admin. AEROSFORGE does not claim FAA approval, certification, or flight instruction.</p></article></section>
    <section id="academy" className="section"><div className="kicker">Platform foundation</div><h2>One product now. Connected engines underneath.</h2><div className="grid">{pillars.map(([title,text,href])=><article className="card" key={title}><h3>{title}</h3><p className="muted">{text}</p><Link className="button" href={href}>Open →</Link></article>)}</div></section>
  </main>;
}
