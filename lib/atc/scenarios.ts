import type { Scenario } from './types';
import {assertScenarioValid} from './validate';
export const scenarios: Scenario[] = [{
  id:'KJYO-IFR-DEP-001', title:'Leesburg IFR Departure + Radio Failure Awareness', version:1,
  initial:{id:'start',phase:'clearance',airport:'KJYO',activeRunway:'17',frequency:'125.05',squawk:'4621',clearanceLimit:'MRB'},
  transmissions:{
    start:{id:'start',controllerText:'AeroComm Seven Two Three Alpha Charlie, cleared to Martinsburg Airport via radar vectors, then as filed. Maintain three thousand, expect six thousand ten minutes after departure. Departure frequency one two five point zero five, squawk four six two one.',expected:{callsign:'723AC',clearanceLimit:'MRB',altitude:'3000',frequency:'125.05',squawk:'4621'},critical:['callsign','clearanceLimit','altitude','frequency','squawk'],nextState:'taxi'},
    taxi:{id:'taxi',controllerText:'AeroComm Three Alpha Charlie, runway one seven, taxi via Alpha, hold short runway one seven.',expected:{callsign:'723AC',runway:'17',holdShort:'17'},critical:['callsign','runway','holdShort'],nextState:'departure'},
    departure:{id:'departure',controllerText:'AeroComm Three Alpha Charlie, fly heading two zero zero, runway one seven cleared for takeoff.',expected:{callsign:'723AC',heading:'200',runway:'17'},critical:['callsign','heading','runway'],nextState:'complete'}
  }
}];
scenarios.forEach(assertScenarioValid);
export function getScenario(id:string){return scenarios.find(s=>s.id===id) ?? scenarios[0];}
