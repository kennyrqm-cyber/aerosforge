import {createHash,randomUUID} from 'crypto';
import {canonicalJson} from './integrity';

export type AuditEvent={id:string;at:string;actorId:string|null;action:string;subjectType:string;subjectId:string;payload:Record<string,unknown>;previousHash:string|null;hash:string};
type AuditUnsigned=Omit<AuditEvent,'hash'>;

function hashUnsigned(event:AuditUnsigned){return createHash('sha256').update(canonicalJson(event)).digest('hex');}

export function createAuditEvent(input:Omit<AuditEvent,'id'|'at'|'hash'>):AuditEvent{
  const base:AuditUnsigned={id:randomUUID(),at:new Date().toISOString(),...input};
  return {...base,hash:hashUnsigned(base)};
}

export function verifyAuditEvent(event:AuditEvent){
  const {hash,...unsigned}=event;
  return /^[a-f0-9]{64}$/i.test(hash)&&hashUnsigned(unsigned)===hash;
}

export function verifyAuditChain(events:AuditEvent[],initialPreviousHash:string|null=null){
  let expectedPrevious=initialPreviousHash;
  for(let index=0;index<events.length;index++){
    const event=events[index];
    if(event.previousHash!==expectedPrevious) return {valid:false,index,reason:'previous_hash_mismatch' as const};
    if(!verifyAuditEvent(event)) return {valid:false,index,reason:'event_hash_mismatch' as const};
    expectedPrevious=event.hash;
  }
  return {valid:true,index:null,reason:null,headHash:expectedPrevious};
}
