import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { isAccountEmailDeliveryConfigured } from "@/lib/account-email";

export default function ForgotPasswordPage() {
  if (!isAccountEmailDeliveryConfigured()) return <main><section className="form card"><span className="badge">CONTROLLED LAUNCH</span><h2>Account recovery is not open yet.</h2><p className="muted">Password recovery remains locked until transactional email delivery and the sending domain have been verified.</p><Link className="button" href="/sign-in">Return to sign in</Link></section></main>;
  return <main><ForgotPasswordForm/><p style={{textAlign:"center"}} className="muted"><Link className="gold" href="/sign-in">Return to sign in</Link></p></main>;
}
