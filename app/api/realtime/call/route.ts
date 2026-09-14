import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '../../../../lib/supabase/server';
import {consumeProviderQuota} from '../../../../lib/supabase/quota';

export async function POST(request:Request){
  const user=await getAuthenticatedUser();
  if(!user) return NextResponse.json({error:'Authentication required.'},{status:401});
  if(process.env.AEROCOMM_ENABLE_REALTIME!=='true') return NextResponse.json({error:'Realtime transport is disabled.'},{status:503});
  if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:'Realtime provider is not configured.'},{status:503});
  const quota=await consumeProviderQuota('realtime_call',10,60);
  if(!quota.allowed) return NextResponse.json({error:'Realtime call rate limit reached.'},{status:429,headers:{'Retry-After':String(quota.retryAfterSeconds)}});
  const sdp=await request.text();
  if(!sdp||sdp.length>250_000) return NextResponse.json({error:'Invalid SDP offer.'},{status:400});
  const form=new FormData();
  form.set('sdp',sdp);
  form.set('session',JSON.stringify({
    type:'realtime',
    model:process.env.OPENAI_REALTIME_MODEL||'gpt-realtime',
    instructions:'AeroComm transport session. Do not issue aviation clearances, vectors, runway assignments, frequencies, squawk codes, or pass/fail decisions. The application deterministic engine owns all ATC state and grading. Provide transcription events only when configured by the provider session.',
    audio:{input:{transcription:{model:process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL||'gpt-4o-mini-transcribe'}}}
  }));
  try{
    const upstream=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,cache:'no-store'});
    const body=await upstream.text();
    if(!upstream.ok) return NextResponse.json({error:'Realtime provider rejected the SDP offer.',providerStatus:upstream.status},{status:502});
    return new Response(body,{status:200,headers:{'Content-Type':'application/sdp','Cache-Control':'no-store','X-AeroComm-Call-Id':upstream.headers.get('Location')?.split('/').pop()||''}});
  }catch{return NextResponse.json({error:'Realtime provider is unreachable.'},{status:502})}
}
