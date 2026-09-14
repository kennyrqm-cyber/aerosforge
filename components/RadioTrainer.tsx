'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import PTTConsole from './PTTConsole';
import {beginScenario,currentTransmission,submitReadback,type EngineSession} from '../lib/atc/engine';
import {getScenario} from '../lib/atc/scenarios';
import {coach,type CoachingLanguage} from '../lib/atc/multilingual';
import {speakController} from '../lib/audio/controllerVoice';
import {clearSnapshot,completeRemoteSession,createRemoteSession,loadSnapshot,persistAttempt,saveSnapshot,type AttemptTelemetry,type RadioAttempt} from '../lib/persistence/sessionStore';

const languageNames:Record<CoachingLanguage,string>={en:'English',es:'Español',fr:'Français',pt:'Português',de:'Deutsch'};

export default function RadioTrainer(){
 const scenario=useMemo(()=>getScenario('KJYO-IFR-DEP-001'),[]);
 const [session,setSession]=useState<EngineSession>(()=>beginScenario(scenario));
 const [attempts,setAttempts]=useState<RadioAttempt[]>([]);
 const [remoteSessionId,setRemoteSessionId]=useState<string>();
 const [syncState,setSyncState]=useState<'local'|'synced'|'error'>('local');
 const [transcript,setTranscript]=useState('');
 const [last,setLast]=useState<ReturnType<typeof submitReadback>['score']|null>(null);
 const [lang,setLang]=useState<CoachingLanguage>('en');
 const [voiceStatus,setVoiceStatus]=useState('');
 const pendingTelemetry=useRef<AttemptTelemetry>({});
 const transcriptSource=useRef<'typed'|'batch-stt'|'realtime-stt'>('typed');
 const tx=currentTransmission(scenario,session);

 useEffect(()=>{
   const saved=loadSnapshot();
   if(saved?.session.scenarioId===scenario.id&&saved.session.scenarioVersion===scenario.version){setSession(saved.session);setAttempts(saved.attempts||[]);setRemoteSessionId(saved.remoteSessionId);setSyncState(saved.syncState||'local')}
 },[scenario]);
 useEffect(()=>{saveSnapshot({session,attempts,remoteSessionId,syncState})},[session,attempts,remoteSessionId,syncState]);
 useEffect(()=>{if(remoteSessionId) return;createRemoteSession(scenario.id,scenario.version).then(id=>{if(id){setRemoteSessionId(id);setSyncState('synced')}}).catch(()=>setSyncState('error'))},[remoteSessionId,scenario.id,scenario.version]);

 async function grade(){
   if(!tx||!transcript.trim()) return;
   const before=session;const scoreStarted=performance.now();
   const result=submitReadback(scenario,session,transcript);const scoredAt=performance.now();
   const attemptIndex=attempts.filter(a=>a.turn===before.turn).length+1;
   const telemetry:AttemptTelemetry={...pendingTelemetry.current,scoredAt,scoreLatencyMs:Math.round(scoredAt-scoreStarted),endToEndMs:pendingTelemetry.current.captureStartedAt?Math.round(scoredAt-pendingTelemetry.current.captureStartedAt):undefined};
   const attempt:RadioAttempt={id:crypto.randomUUID(),at:new Date().toISOString(),scenarioId:scenario.id,scenarioVersion:scenario.version,stateId:before.stateId,turn:before.turn,attemptIndex,controllerText:tx.controllerText,transcript:transcript.trim(),score:result.score,telemetry,source:transcriptSource.current};
   setLast(result.score);setSession(result.session);setAttempts(prev=>[...prev,attempt]);
   pendingTelemetry.current={};transcriptSource.current='typed';
   const persisted=await persistAttempt(remoteSessionId,attempt).catch(()=>({synced:false,error:'sync failed'}));
   if(remoteSessionId)setSyncState(persisted.synced?'synced':'error');
   if(result.score.passed)setTranscript('');
   if(result.session.complete){const next={session:result.session,attempts:[...attempts,attempt],remoteSessionId,syncState};await completeRemoteSession(remoteSessionId,next).catch(()=>({synced:false}));}
 }
 function restart(){const fresh=beginScenario(scenario);setSession(fresh);setAttempts([]);setTranscript('');setLast(null);setRemoteSessionId(undefined);setSyncState('local');clearSnapshot();}
 function playController(){if(!tx)return;try{speakController(tx.controllerText);setVoiceStatus('Controller audio playing through browser speech synthesis.');}catch(e){setVoiceStatus(e instanceof Error?e.message:'Controller audio unavailable.')}}
 function receiveTranscript(text:string,telemetry:AttemptTelemetry){setTranscript(text);pendingTelemetry.current=telemetry;transcriptSource.current='batch-stt'}
 if(session.complete)return <section className="card"><h2>Scenario complete</h2><p>You completed the deterministic scenario sequence.</p><p><strong>Recorded attempts:</strong> {attempts.length}</p><p><strong>Persistence:</strong> {syncState==='synced'?'Supabase session synchronized':'Local device record'}</p><p className="small">Completion is training evidence only. It is not a certificate, FAA credit, or WINGS credit.</p><button onClick={restart}>Restart scenario</button></section>;
 return <div className="trainer-grid">
   <section className="card"><div className="row"><span className="badge">{scenario.id}</span><span className="badge">Turn {session.turn+1}</span><span className="badge">v{scenario.version}</span><span className="badge">{syncState==='synced'?'SYNCED':'LOCAL'}</span></div><h2>Controller</h2><p className="controller">“{tx?.controllerText}”</p><div className="actions"><button onClick={playController}>▶ Play controller</button></div><p className="small" aria-live="polite">{voiceStatus}</p><h3>Expected critical elements</h3><div>{tx?.critical.map(x=><span className="badge" key={x}>{x}</span>)}</div></section>
   <PTTConsole onTranscript={receiveTranscript}/>
   <section className="card"><h2>You said</h2><p className="small">Server STT can populate this field. Manual correction remains available during validation so transcription errors can be distinguished from readback errors.</p><textarea value={transcript} onChange={e=>{setTranscript(e.target.value);transcriptSource.current='typed'}} placeholder="Example: AeroComm seven two three Alpha Charlie..."/><div className="actions"><button onClick={grade}>Score readback</button><button className="secondary" onClick={restart}>Reset</button></div></section>
   <section className="card"><h2>Coach</h2><label>Coaching language <select value={lang} onChange={e=>setLang(e.target.value as CoachingLanguage)}>{Object.entries(languageNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{last?<><p className={last.passed?'pass':'fail'}>{coach(lang,last.passed)}</p><p><strong>Score:</strong> {last.score}%</p><p><strong>Matched:</strong> {last.matched.join(', ')||'none'}</p><p><strong>Missing:</strong> {last.missing.join(', ')||'none'}</p>{last.feedback.map((f,i)=><p className="small" key={i}>{f}</p>)}</>:<p className="small">No readback scored yet.</p>}<p className="small">Attempts: {attempts.length}</p>{attempts.at(-1)?.telemetry.endToEndMs&&<p className="small">Last key-up → score: {attempts.at(-1)?.telemetry.endToEndMs} ms</p>}</section>
 </div>;
}
