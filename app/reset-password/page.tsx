import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { isAccountEmailDeliveryConfigured } from "@/lib/account-email";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!isAccountEmailDeliveryConfigured()) return <main><section className="form card"><span className="badge">CONTROLLED LAUNCH</span><h2>Account recovery is not open yet.</h2><p className="muted">No password can be changed until verified email delivery is enabled.</p><Link className="button" href="/sign-in">Return to sign in</Link></section></main>;
  if (error || !token) return <main><section className="form card"><span className="badge danger">INVALID LINK</span><h2>This reset link is invalid or expired.</h2><Link className="button primary" href="/forgot-password">Request a new reset link</Link></section></main>;
  return <main><ResetPasswordForm token={token}/></main>;
}
