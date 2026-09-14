export type CriticalField = 'callsign'|'runway'|'altitude'|'heading'|'frequency'|'squawk'|'holdShort'|'clearanceLimit';
export type ExpectedReadback = Partial<Record<CriticalField,string>>;
export type Transmission = { id:string; controllerText:string; expected:ExpectedReadback; critical:CriticalField[]; nextState:string };
export type ScenarioState = { id:string; phase:string; airport:string; activeRunway:string; frequency:string; altitude?:string; heading?:string; squawk?:string; holdShort?:string; clearanceLimit?:string };
export type Scenario = { id:string; title:string; version:number; initial:ScenarioState; transmissions:Record<string,Transmission> };
export type ScoreResult = { score:number; passed:boolean; criticalError:boolean; matched:string[]; missing:string[]; feedback:string[] };
