"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";
export function AuthForm({mode}:{mode:Mode}) {
  const router=useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function onSubmit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form=new FormData(event.currentTarget); const email=String(form.get("email")??""); const password=String(form.get("password")??""); const name=String(form.get("name")??"");
    const result=mode==="sign-up"?await authClient.signUp.email({name,email,password}):await authClient.signIn.email({email,password});
    setBusy(false); if(result.error){setError(result.error.message??"Authentication failed.");return;} router.push("/dashboard"); router.refresh();
  }
  return <form className="form card" onSubmit={onSubmit}><span className="badge">{mode==="sign-up"?"NEW PILOT":"RETURNING PILOT"}</span><h2>{mode==="sign-up"?"Create your Pilot Passport":"Return to Mission Control"}</h2><p className="muted">{mode==="sign-up"?"New accounts start as STUDENT. CFI and ADMIN privileges are never self-assigned.":"Your server-validated role determines which command center you can access."}</p>{mode==="sign-up"&&<><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="name" required/></>}<label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode==="sign-up"?"new-password":"current-password"} minLength={10} maxLength={128} required/>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={busy}>{busy?"Working…":mode==="sign-up"?"Create account":"Sign in"}</button></form>;
}
