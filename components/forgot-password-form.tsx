"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (result.error) {
        setError("We could not submit that request. Wait a moment and try again.");
        return;
      }
      setMessage("If that address belongs to an account, a secure reset link is on its way.");
    } catch {
      setError("We could not submit that request. Wait a moment and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="form card" onSubmit={onSubmit}>
    <span className="badge">ACCOUNT RECOVERY</span>
    <h2>Reset your password</h2>
    <p className="muted">Enter your account email. For privacy, the response is the same whether or not an account exists.</p>
    <label htmlFor="recovery-email">Email</label>
    <input id="recovery-email" name="email" type="email" autoComplete="email" required/>
    {message && <p className="notice successBox">{message}</p>}
    {error && <p className="error">{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send secure reset link"}</button>
  </form>;
}
