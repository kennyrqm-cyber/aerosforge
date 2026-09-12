import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignUpPage(){
  const signupEnabled = process.env.PUBLIC_SIGNUP_ENABLED === "true";
  if (!signupEnabled) return <main><section className="form card"><span className="badge">CONTROLLED LAUNCH</span><h2>Public registration is not open yet.</h2><p className="muted">AEROSFORGE ONE is keeping new-account creation closed until the production email-verification and recovery path has been exercised.</p><Link className="button" href="/sign-in">Existing user sign in</Link></section></main>;
  return <main><AuthForm mode="sign-up"/><p style={{textAlign:"center"}} className="muted">Already registered? <Link className="gold" href="/sign-in">Sign in</Link></p></main>;
}
