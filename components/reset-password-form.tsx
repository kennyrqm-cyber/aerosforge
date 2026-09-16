"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError("This reset link is invalid or expired. Request a new one.");
        return;
      }
      setComplete(true);
    } catch {
      setError("The password could not be updated. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (complete) return <section className="form card"><span className="badge success">PASSWORD UPDATED</span><h2>Your password is ready.</h2><Link className="button primary" href="/sign-in">Return to sign in</Link></section>;
  return <form className="form card" onSubmit={onSubmit}>
    <span className="badge">SECURE RESET</span>
    <h2>Choose a new password</h2>
    <label htmlFor="new-password">New password</label>
    <input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/>
    <label htmlFor="confirmation">Confirm password</label>
    <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/>
    {error && <p className="error">{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
  </form>;
}
