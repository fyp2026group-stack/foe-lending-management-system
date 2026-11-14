import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unchangedStock,
  returnConservation,
  stageChain,
  distinctActor,
} from './workflow-oracles.mjs';
test('workflow oracles reject custody and quantity inconsistencies', () => {
  returnConservation({ issued: 3, received: 1, outstanding: 2, inspectionDelta: 1, returned: 1 });
  assert.throws(() =>
    returnConservation({ issued: 3, received: 2, outstanding: 2, inspectionDelta: 1, returned: 1 })
  );
  assert.throws(() => unchangedStock([{ quantity: 1 }], [{ quantity: 0 }]));
  assert.throws(() => distinctActor('synthetic-person', 'synthetic-person'));
  assert.deepEqual(stageChain('BOTH'), ['LECTURER', 'HOD']);
  assert.deepEqual(stageChain('NONE'), []);
});
