import { compact, normalizeSpeech } from './normalize';
import type { ExpectedReadback, CriticalField, ScoreResult } from './types';

const clearanceLimitAliases: Record<string,string[]> = {
  MRB: ['martinsburg', 'martinsburg airport'],
};

function matchesClearanceLimit(spoken:string, expected:string){
  const spokenCompact=compact(spoken);
  const expectedCompact=compact(expected);
  if(spokenCompact.includes(expectedCompact)) return true;
  return (clearanceLimitAliases[expected.toUpperCase()] ?? []).some(alias => spokenCompact.includes(compact(alias)));
}
const aliases:Record<CriticalField,(spoken:string, expected:string)=>boolean>={
  callsign:(s,e)=>compact(s).includes(compact(e)) || compact(s).endsWith(compact(e).slice(-3)),
  runway:(s,e)=>compact(s).includes(compact(e)), altitude:(s,e)=>compact(s).includes(compact(e)),
  heading:(s,e)=>compact(s).includes(compact(e).padStart(3,'0')) || compact(s).includes(compact(e)),
  frequency:(s,e)=>compact(s).includes(compact(e)), squawk:(s,e)=>compact(s).includes(compact(e)),
  holdShort:(s,e)=>normalizeSpeech(s).includes('hold short') && compact(s).includes(compact(e)),
  clearanceLimit:(s,e)=>matchesClearanceLimit(s,e)
};
export function scoreReadback(spoken:string,expected:ExpectedReadback,critical:CriticalField[]):ScoreResult{
  const matched:string[]=[]; const missing:string[]=[]; const feedback:string[]=[];
  for(const [field,val] of Object.entries(expected) as [CriticalField,string][]) (aliases[field](spoken,val)?matched:missing).push(field);
  const criticalMissing=missing.filter(x=>critical.includes(x as CriticalField));
  const score=Math.round((matched.length/Math.max(1,Object.keys(expected).length))*100);
  if(criticalMissing.length) feedback.push(`Critical readback omission: ${criticalMissing.join(', ')}`);
  if(!missing.length) feedback.push('All expected readback elements detected.');
  else feedback.push(`Review: ${missing.join(', ')}`);
  return {score,passed:criticalMissing.length===0 && score>=80,criticalError:criticalMissing.length>0,matched,missing,feedback};
}
