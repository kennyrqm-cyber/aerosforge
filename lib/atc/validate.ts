import type {Scenario,CriticalField} from './types';
const allowedCritical = new Set<CriticalField>(['callsign','runway','altitude','heading','frequency','squawk','holdShort','clearanceLimit']);

export function validateScenario(s:Scenario):string[]{
  const errors:string[]=[];
  if(!s.id.trim()) errors.push('scenario id is required');
  if(!Number.isInteger(s.version)||s.version<1) errors.push('scenario version must be a positive integer');
  if(!s.transmissions[s.initial.id]) errors.push(`initial state ${s.initial.id} has no transmission`);

  for(const [stateId,tx] of Object.entries(s.transmissions)){
    if(tx.id!==stateId) errors.push(`transmission id ${tx.id} must match state key ${stateId}`);
    if(!tx.controllerText.trim()) errors.push(`${stateId}: controllerText is required`);
    if(!Array.isArray(tx.critical)||tx.critical.length===0) errors.push(`${stateId}: at least one critical field is required`);
    if(new Set(tx.critical).size!==tx.critical.length) errors.push(`${stateId}: duplicate critical fields are not allowed`);
    for(const field of tx.critical){
      if(!allowedCritical.has(field)) errors.push(`${stateId}: unsupported critical field ${field}`);
      if(tx.expected[field]==null||String(tx.expected[field]).trim()==='') errors.push(`${stateId}: critical field ${field} has no expected value`);
    }
    if(tx.nextState!=='complete'&&!s.transmissions[tx.nextState]) errors.push(`${stateId}: nextState ${tx.nextState} does not exist`);
    if(tx.nextState===stateId) errors.push(`${stateId}: self-loop is not allowed`);
  }

  // Require every state to be reachable from the declared initial state and every path
  // to terminate instead of cycling forever. Training scenarios are finite state machines.
  if(s.transmissions[s.initial.id]){
    const reachable=new Set<string>();
    let state=s.initial.id;
    while(state!=='complete'&&!reachable.has(state)&&s.transmissions[state]){
      reachable.add(state);
      state=s.transmissions[state].nextState;
    }
    if(state!=='complete'&&reachable.has(state)) errors.push(`scenario contains a cycle at ${state}`);
    for(const stateId of Object.keys(s.transmissions)){
      if(!reachable.has(stateId)) errors.push(`${stateId}: state is unreachable from initial state`);
    }
  }
  return errors;
}

export function assertScenarioValid(s:Scenario){const errors=validateScenario(s);if(errors.length)throw new Error(`Invalid scenario ${s.id}: ${errors.join('; ')}`);return s;}
