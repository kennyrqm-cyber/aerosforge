'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '../lib/supabase/client';

export default function AuthPanel(){
  const [email,setEmail]=useState('');
  const [status,setStatus]=useState('');
  const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  async function submit(e:FormEvent){
    e.preventDefault();
    if(!configured){setStatus('Supabase authentication is not configured in this build.');return;}
    const supabase=createClient();
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/auth/callback?next=/practice'}});
    setStatus(error?`Sign-in failed: ${error.message}`:'Check your email for the secure sign-in link.');
  }
  async function signOut(){
    if(!configured)return;
    const supabase=createClient(); await supabase.auth.signOut(); window.location.href='/';
  }
  return <section className="card"><h2>Secure sign in</h2><p className="small">Magic-link authentication. Instructor/admin access is still enforced by database role and RLS.</p><form onSubmit={submit}><input aria-label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="pilot@example.com" required/><button type="submit">Email sign-in link</button></form><div className="actions" style={{marginTop:10}}><button type="button" className="secondary" onClick={signOut}>Sign out</button></div>{status&&<p className="small">{status}</p>}</section>;
}
