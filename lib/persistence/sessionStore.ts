import type { EngineSession } from '../atc/engine';
import type { ScoreResult } from '../atc/types';
import { createClient } from '../supabase/client';

export type AttemptTelemetry = {
  captureStartedAt?: number;
  captureEndedAt?: number;
  transcriptReceivedAt?: number;
  scoredAt?: number;
  audioDurationMs?: number;
  transcriptionLatencyMs?: number;
  scoreLatencyMs?: number;
  endToEndMs?: number;
};

export type RadioAttempt = {
  id: string;
  at: string;
  scenarioId: string;
  scenarioVersion: number;
  stateId: string;
  turn: number;
  attemptIndex: number;
  controllerText: string;
  transcript: string;
  score: ScoreResult;
  telemetry: AttemptTelemetry;
  source: 'typed'|'batch-stt'|'realtime-stt';
};

export type SessionSnapshot = {
  session: EngineSession;
  attempts: RadioAttempt[];
  remoteSessionId?: string;
  syncState?: 'local'|'synced'|'error';
};

const KEY='aerocomm-master-session-v1';
const LEGACY_KEYS=['aerocomm-mvp-session-v05'];

export function loadSnapshot():SessionSnapshot|null{
  if(typeof window==='undefined') return null;
  try{
    const current=localStorage.getItem(KEY);
    if(current) return JSON.parse(current) as SessionSnapshot;
    for(const legacyKey of LEGACY_KEYS){
      const legacy=localStorage.getItem(legacyKey);
      if(legacy){
        const snapshot=JSON.parse(legacy) as SessionSnapshot;
        localStorage.setItem(KEY,JSON.stringify(snapshot));
        localStorage.removeItem(legacyKey);
        return snapshot;
      }
    }
    return null;
  }catch{return null}
}
export function saveSnapshot(snapshot:SessionSnapshot){if(typeof window!=='undefined')localStorage.setItem(KEY,JSON.stringify(snapshot));}
export function clearSnapshot(){
  if(typeof window!=='undefined'){
    localStorage.removeItem(KEY);
    LEGACY_KEYS.forEach(key=>localStorage.removeItem(key));
  }
}

function configured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}

export async function createRemoteSession(scenarioKey:string,scenarioVersion:number):Promise<string|null>{
  if(!configured()) return null;
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return null;
  const {data:scenario,error:scenarioError}=await supabase.from('scenarios').select('id').eq('scenario_key',scenarioKey).eq('version',scenarioVersion).eq('status','approved').maybeSingle();
  if(scenarioError||!scenario) return null;
  const {data,error}=await supabase.from('sessions').insert({student_id:user.id,scenario_id:scenario.id,metadata:{scenario_key:scenarioKey,scenario_version:scenarioVersion,client:'web'}}).select('id').single();
  if(error||!data) return null;
  return data.id as string;
}

export async function persistAttempt(remoteSessionId:string|undefined,attempt:RadioAttempt){
  if(!remoteSessionId||!configured()) return {synced:false};
  const supabase=createClient();
  const {error}=await supabase.from('transmissions').insert({
    session_id:remoteSessionId,
    turn_index:attempt.turn,
    attempt_index:attempt.attemptIndex,
    speaker:'student',
    transcript:attempt.transcript,
    expected:{state_id:attempt.stateId,controller_text:attempt.controllerText},
    score:{...attempt.score,telemetry:attempt.telemetry,source:attempt.source}
  });
  return {synced:!error,error:error?.message};
}

export async function completeRemoteSession(remoteSessionId:string|undefined,snapshot:SessionSnapshot){
  if(!remoteSessionId||!configured()) return {synced:false};
  const critical=snapshot.attempts.filter(a=>a.score.criticalError).length;
  const final=snapshot.attempts.at(-1)?.score;
  const supabase=createClient();
  const {error}=await supabase.from('sessions').update({completed_at:new Date().toISOString(),score:final?.score??null,passed:snapshot.session.complete,critical_error_count:critical,metadata:{scenario_key:snapshot.session.scenarioId,scenario_version:snapshot.session.scenarioVersion,attempt_count:snapshot.attempts.length}}).eq('id',remoteSessionId);
  return {synced:!error,error:error?.message};
}
