import Link from "next/link";

const pillars = [
  ["Academy", "30 structured vertical-flight lessons behind a real review/publish gate.", "/academy"],
  ["Pilot Passport", "Persistent XP, badges, progress, and professional-development milestones.", "/dashboard"],
  ["The Gauntlet", "Scenario-based decision practice with auditable attempts and first-completion XP.", "/gauntlet"],
  ["Rotor Coach", "AI-assisted study remains behind the next safety-and-source implementation gate.", "/dashboard"],
  ["CFI Network", "Instructor review, student assignment, content governance, and progress visibility.", "/dashboard"],
  ["Winchester 2027", "A consent-based funnel from free learning to future discovery-flight and training conversations.", "/winchester"]
] as const;

export default function Home() {
  const signupEnabled = process.env.PUBLIC_SIGNUP_ENABLED === "true";
  const leadCollectionEnabled = process.env.WINCHESTER_LEADS_ENABLED === "true";
  return <main>
    <section className="hero">
      <div>
        <div className="kicker">Global Vertical Flight Network</div>
        <h1>BUILD THE NEXT<br/><span>GENERATION</span><br/>OF ROTOR PILOTS.</h1>
        <p className="muted" style={{fontSize:18}}>AEROSFORGE ONE is evolving the original static MVP into an authenticated aviation-learning platform with persistent progress, scenario training, instructor review, and a real pathway toward Winchester 2027.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="button primary" href="/sign-up">{signupEnabled ? "Create free account →" : "View controlled launch →"}</Link><Link className="button" href="/winchester">Winchester 2027 pathway</Link></div>
      </div>
      <div className="heroCard"><span className="badge">AEROSFORGE ONE</span><p className="muted">LEARN • FLY • EARN • ADVANCE • TRANSFORM</p><strong>AEROS<span>FORGE</span></strong><p>Production architecture with secure identity, role-owned access, PostgreSQL persistence, content governance, explicit lead consent, audit events, and deployment gates.</p></div>
    </section>
    <section id="academy" className="section"><div className="kicker">Platform engines</div><h2>One ecosystem. Six connected missions.</h2><div className="grid">{pillars.map(([title,text,href])=><article className="card" key={title}><h3>{title}</h3><p className="muted">{text}</p><Link className="button" href={href}>Open →</Link></article>)}</div></section>
    <section className="section grid2"><article className="card"><div className="kicker">Winchester 2027</div><h2>Digital runway to a real academy.</h2><p className="muted">Interest → readiness → discovery-flight conversation → instructor evaluation → future flight training. Interest records are persisted with explicit contact consent.</p><Link className="button primary" href="/winchester">{leadCollectionEnabled ? "Join the pathway" : "View pathway status"}</Link></article><article className="card"><div className="kicker">Safety boundary</div><h2>Publication requires review.</h2><p className="muted">Seeded lessons and scenarios remain DRAFT until reviewed. Students only see PUBLISHED content. AEROSFORGE does not represent prototype material as FAA approval, certification, or flight instruction.</p></article></section>
  </main>;
}
