import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const buildDir = '.core-build';

rmSync(buildDir, { recursive: true, force: true });
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '-p', 'tsconfig.engine-test.json'], { stdio: 'inherit' });

const { beginScenario, currentTransmission, submitReadback } = require('../.core-build/engine.js');
const { scoreReadback } = require('../.core-build/scoring.js');

const scenario = {
  id: 'release-gate-pattern',
  title: 'Deterministic ATC engine release gate',
  version: 1,
  initial: {
    id: 'taxi',
    phase: 'ground',
    airport: 'KMRB',
    activeRunway: '26',
    frequency: '121.8'
  },
  transmissions: {
    taxi: {
      id: 'taxi',
      controllerText: 'Helicopter 123AB, taxi runway 26, hold short runway 26.',
      expected: { callsign: '123AB', runway: '26', holdShort: '26' },
      critical: ['callsign', 'runway', 'holdShort'],
      nextState: 'departure'
    },
    departure: {
      id: 'departure',
      controllerText: 'Helicopter 123AB, fly heading 270, maintain 3000.',
      expected: { callsign: '123AB', heading: '270', altitude: '3000' },
      critical: ['callsign', 'heading', 'altitude'],
      nextState: 'complete'
    }
  }
};

const initial = beginScenario(scenario);
assert.deepEqual(initial, {
  scenarioId: scenario.id,
  scenarioVersion: scenario.version,
  stateId: 'taxi',
  turn: 0,
  complete: false
});
assert.equal(currentTransmission(scenario, initial)?.id, 'taxi');

const failed = submitReadback(scenario, initial, 'Helicopter 123AB taxi runway 26');
assert.equal(failed.score.passed, false);
assert.equal(failed.score.criticalError, true);
assert.ok(failed.score.missing.includes('holdShort'));
assert.equal(failed.session.stateId, 'taxi');
assert.equal(failed.session.turn, 0);
assert.equal(failed.session.complete, false);

const passed = submitReadback(scenario, initial, 'Helicopter 123AB taxi runway 26, hold short runway 26');
assert.equal(passed.score.passed, true);
assert.equal(passed.score.criticalError, false);
assert.equal(passed.score.score, 100);
assert.equal(passed.session.stateId, 'departure');
assert.equal(passed.session.turn, 1);
assert.equal(passed.session.complete, false);
assert.equal(currentTransmission(scenario, passed.session)?.id, 'departure');

const completed = submitReadback(scenario, passed.session, 'Helicopter 123AB heading 270 maintain 3000');
assert.equal(completed.score.passed, true);
assert.equal(completed.session.stateId, 'complete');
assert.equal(completed.session.turn, 2);
assert.equal(completed.session.complete, true);

const partialNoncritical = scoreReadback(
  'Helicopter 123AB runway 26',
  { callsign: '123AB', runway: '26', frequency: '121.8' },
  ['callsign', 'runway']
);
assert.equal(partialNoncritical.criticalError, false);
assert.equal(partialNoncritical.passed, false);
assert.equal(partialNoncritical.score, 67);
assert.ok(partialNoncritical.missing.includes('frequency'));

const clearanceAlias = scoreReadback(
  'Cleared to Martinsburg airport, Helicopter 123AB',
  { callsign: '123AB', clearanceLimit: 'MRB' },
  ['callsign', 'clearanceLimit']
);
assert.equal(clearanceAlias.passed, true);
assert.equal(clearanceAlias.score, 100);

rmSync(buildDir, { recursive: true, force: true });
console.log('AeroComm ATC engine release tests passed.');
