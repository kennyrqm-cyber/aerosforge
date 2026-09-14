import type { Scenario, ScoreResult } from './types';
import { scoreReadback } from './scoring';
export type EngineSession={scenarioId:string;scenarioVersion:number;stateId:string;turn:number;complete:boolean};
export function beginScenario(s:Scenario):EngineSession{return {scenarioId:s.id,scenarioVersion:s.version,stateId:s.initial.id,turn:0,complete:false};}
export function currentTransmission(s:Scenario,session:EngineSession){return s.transmissions[session.stateId];}
export function submitReadback(s:Scenario,session:EngineSession,spoken:string):{score:ScoreResult;session:EngineSession}{
 const tx=currentTransmission(s,session); if(!tx) throw new Error('Scenario state has no transmission');
 const score=scoreReadback(spoken,tx.expected,tx.critical);
 const next=score.passed?tx.nextState:session.stateId;
 const nextTurn=score.passed?session.turn+1:session.turn;
 return {score,session:{...session,stateId:next,turn:nextTurn,complete:next==='complete'}};
}
