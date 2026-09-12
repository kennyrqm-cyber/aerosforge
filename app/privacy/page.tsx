import Link from "next/link";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export default function PrivacyPage() {
  return <main>
    <section className="section policyPage">
      <div className="kicker">Prelaunch privacy notice • Version {PRIVACY_NOTICE_VERSION}</div>
      <h1 className="compactHeading">PRIVACY<br/><span>WITHOUT</span><br/>SURPRISES.</h1>
      <p className="notice warningBox"><strong>Prelaunch notice:</strong> this product notice is an operational draft and must receive legal/privacy review before a commercial production launch.</p>
      <div className="card policyCopy">
        <h2>What AEROSFORGE ONE collects</h2>
        <p>Account features may store your name, email address, authentication records, learning progress, badges, scenario attempts, and profile information you choose to provide.</p>
        <p>The Winchester interest pathway may store your name, email, optional phone number, experience level, desired start timing, message, the fact that you consented to contact, the time of that consent, and the privacy-notice version shown when you submitted.</p>
        <h2>Why it is used</h2>
        <p>We use this information to operate accounts, protect the service, track learning progress, support instructor workflows, respond to Winchester pathway requests, maintain audit records, and improve the platform.</p>
        <h2>Winchester contact consent</h2>
        <p>Submitting the Winchester form requires explicit consent to be contacted about that pathway. Submission is not enrollment, does not reserve a training slot, and creates no purchase obligation.</p>
        <h2>Safety and aviation records</h2>
        <p>AEROSFORGE ONE is an educational platform. The current system is not an FAA certification system and should not be used as the official record for pilot certificates, endorsements, aircraft maintenance, flight time, or regulatory compliance.</p>
        <h2>Access and security</h2>
        <p>Role-protected areas are restricted to authorized students, CFIs, and administrators. Administrative changes, content publication, instructor assignments, and lead-status changes are designed to create audit events.</p>
        <h2>Retention and deletion</h2>
        <p>Formal retention periods and a self-service deletion process are not yet finalized. Those controls are a production-launch requirement. Until then, do not collect information that is unnecessary for the stated product purpose.</p>
        <h2>Third parties and payments</h2>
        <p>Production infrastructure providers may process information on behalf of AEROSFORGE. Payments are not part of this release candidate. A final notice must identify applicable production vendors and legal bases before commercial launch.</p>
        <h2>Questions or requests</h2>
        <p>Before production launch, AEROSFORGE must publish a monitored privacy-contact channel for access, correction, deletion, and other privacy requests.</p>
        <p><Link className="button" href="/winchester">Return to Winchester pathway</Link></p>
      </div>
    </section>
  </main>;
}
