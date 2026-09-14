import Link from "next/link";
import { PrivacyRequestType } from "@/generated/prisma/client";
import { submitPrivacyRequest } from "@/lib/actions";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import {
  getPrivacyContactEmail,
  getPrivacyResponseDays,
  isPrivacyRequestIntakeConfigured
} from "@/lib/privacy-requests";

const requestLabels: Record<PrivacyRequestType, string> = {
  ACCESS: "Access my information",
  CORRECTION: "Correct my information",
  DELETION: "Delete my information",
  PORTABILITY: "Receive a portable copy",
  CONSENT_WITHDRAWAL: "Withdraw contact consent",
  APPEAL: "Appeal a prior decision"
};

export default async function PrivacyPage({
  searchParams
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const params = await searchParams;
  const contactEmail = getPrivacyContactEmail();
  const intakeEnabled = isPrivacyRequestIntakeConfigured();
  const responseDays = getPrivacyResponseDays();

  return <main>
    <section className="section policyPage">
      <div className="kicker">Prelaunch privacy notice • Version {PRIVACY_NOTICE_VERSION}</div>
      <h1 className="compactHeading">PRIVACY<br/><span>WITHOUT</span><br/>SURPRISES.</h1>
      <p className="notice warningBox"><strong>Prelaunch notice:</strong> this operational draft still requires qualified legal/privacy review before a commercial production launch. It does not claim that AEROSFORGE is compliant with every law in every jurisdiction.</p>
      <div className="card policyCopy">
        <h2>What AEROSFORGE ONE collects</h2>
        <p>Account features may store your name, email address, authentication records, learning progress, badges, scenario attempts, and profile information you choose to provide.</p>
        <p>The Winchester interest pathway may store your name, email, optional phone number, experience level, desired start timing, message, contact consent, consent time, and the privacy-notice version shown when you submitted.</p>
        <p>The Checkride Accelerator application may store your name, email, optional phone number, current certificate level, rating goal, training aircraft, target checkride timing, preparation challenge, preferred format, campaign/source labels, contact consent, consent time, and the privacy-notice version shown when you submitted. Authorized administrators may also record internal follow-up notes, pipeline status, next-action dates, and contact, qualification, enrollment, or closure timestamps.</p>
        <p>A privacy request may store your name, email, request type, optional details, request status, identity-verification time, response target, resolution time, and restricted internal handling notes.</p>

        <h2>Why it is used</h2>
        <p>We use this information to operate accounts, protect the service, track learning progress, support instructor workflows, respond to authorized interest and privacy requests, maintain audit records, and improve the platform.</p>

        <h2>Contact consent</h2>
        <p>Submitting a Winchester or Checkride Accelerator form requires explicit consent to be contacted about that pathway. Submission is not enrollment, does not reserve a training slot, creates no purchase obligation, and can be withdrawn. After a consent-withdrawal request is verified and completed, the workflow suppresses the matching lead contact flags and scheduled follow-up.</p>

        <h2>Safety and aviation records</h2>
        <p>AEROSFORGE ONE is an educational platform. The current system is not an FAA certification system and should not be used as the official record for pilot certificates, endorsements, aircraft maintenance, flight time, or regulatory compliance.</p>

        <h2>Access and security</h2>
        <p>Role-protected areas are restricted to authorized students, CFIs, and administrators. Administrative changes, content publication, instructor assignments, lead-status changes, and privacy-case changes are designed to create audit events.</p>

        <h2>Retention and deletion</h2>
        <p>AEROSFORGE minimizes collection during controlled launch. A final retention schedule and reviewed erasure procedure remain production-launch requirements. A deletion request is not executed automatically: identity must first be verified, then an authorized administrator must evaluate applicable recordkeeping, security, fraud-prevention, legal, and safety exceptions before recording resolution.</p>

        <h2>Third parties and payments</h2>
        <p>Production infrastructure providers may process information on behalf of AEROSFORGE. Payments are not part of this release candidate. A final notice must identify applicable production vendors and legal bases before commercial launch.</p>

        <h2>Privacy requests</h2>
        <p>You may request access, correction, deletion, portability, withdrawal of contact consent, or appeal a prior decision. The case system uses a {responseDays}-day initial response target as an operational safeguard. Applicable rights, exceptions, and deadlines depend on the person and jurisdiction.</p>
        <p>We will not provide, change, or delete personal information until identity is reasonably verified. Do not submit government IDs, medical information, certificate numbers, payment data, passwords, or other sensitive documents through this form.</p>
        {contactEmail ? <p>Monitored privacy contact: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p> : null}
      </div>

      <div className="section applicationShell" id="privacy-request">
        <div>
          <div className="kicker">Data-rights operations</div>
          <h2>Make a privacy request.</h2>
          <p className="muted">This channel is for privacy rights and consent withdrawal—not aviation support, emergency assistance, or legal advice.</p>
          {params.submitted === "1" ? <p className="notice successBox"><strong>Request received.</strong> AEROSFORGE recorded the case. Identity verification may be required before action is taken.</p> : null}
        </div>
        {intakeEnabled ? <form className="card leadForm" action={submitPrivacyRequest}>
          <div className="formGrid">
            <label>First name<input name="firstName" autoComplete="given-name" required maxLength={80}/></label>
            <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80}/></label>
          </div>
          <label>Email associated with your data<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
          <label>Request type<select name="requestType" required defaultValue={PrivacyRequestType.ACCESS}>{Object.values(PrivacyRequestType).map((type) => <option key={type} value={type}>{requestLabels[type]}</option>)}</select></label>
          <label>Details <span className="muted">(optional; do not include sensitive documents)</span><textarea name="details" rows={5} maxLength={2000}/></label>
          <label className="consent"><input name="acknowledgement" value="yes" type="checkbox" required/><span>I understand that AEROSFORGE must verify my identity before providing, changing, or deleting personal information.</span></label>
          <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
          <button className="primary" type="submit">Submit privacy request →</button>
        </form> : <article className="card controlledOffer">
          <span className="badge">CONTROLLED LAUNCH</span>
          <h2>Privacy request intake is not open yet.</h2>
          <p className="muted">No request is accepted by this prototype. The channel remains locked until a monitored privacy mailbox and trained case owner are configured.</p>
          {contactEmail ? <a className="button" href={`mailto:${contactEmail}`}>Email the privacy contact</a> : <Link className="button" href="/">Return home</Link>}
        </article>}
      </div>
    </section>
  </main>;
}
