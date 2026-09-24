import assert from 'node:assert/strict';
import {
  buildNeoGuideLocalLanguageRequest,
  requestNeoGuideLocalLanguageInterpretation,
  shouldUseNeoGuideLocalLanguage,
} from '../utils/neoGuideLocalLanguageClient.ts';

const lowAnswer = {
  intent: 'UNKNOWN',
  entities: [],
  confidence: 'low',
  answer: "I don't know the answer to that yet.",
  matches: [],
  conversation: {},
};

const highAnswer = {
  intent: 'HOW_TO',
  entities: [],
  confidence: 'high',
  answer: 'Steps:\n1. Open Staff.',
  matches: [{ functionId: 'function.curated.people.delete-staff', name: 'Delete staff member' }],
  conversation: {},
};

assert.equal(
  shouldUseNeoGuideLocalLanguage('how do I delete someone', lowAnswer, { enabled: false, endpoint: '', timeoutMs: 1200 }),
  false,
  'Local language layer must be disabled unless configured.'
);

assert.equal(
  shouldUseNeoGuideLocalLanguage('how do I delete someone', lowAnswer, { enabled: true, endpoint: 'http://127.0.0.1:9999/interpret', timeoutMs: 1200 }),
  true,
  'Low confidence answer should be eligible for local language interpretation.'
);

assert.equal(
  shouldUseNeoGuideLocalLanguage('how do I delete staff', highAnswer, { enabled: true, endpoint: 'http://127.0.0.1:9999/interpret', timeoutMs: 1200 }),
  false,
  'High confidence answer should avoid unnecessary local inference.'
);

const request = buildNeoGuideLocalLanguageRequest('how do I delete someone', lowAnswer, {
  page: 'Staff',
  userPermissions: ['staff.view'],
  conversation: { topic: 'Staff' },
});
assert.equal(request.pageContext.page, 'Staff');
assert.equal(request.deterministicAnswer.confidence, 'low');

const valid = await requestNeoGuideLocalLanguageInterpretation(
  request,
  { enabled: true, endpoint: 'http://local/interpret', timeoutMs: 1200 },
  async () => ({
    ok: true,
    json: async () => ({
      confidence: 0.92,
      rewrittenQuestion: 'How do I delete a staff member?',
      intent: 'HOW_TO',
      concepts: ['staff', 'delete'],
      entities: { page: 'Staff' },
      requiresLiveData: false,
    }),
  })
);
assert.equal(valid?.rewrittenQuestion, 'How do I delete a staff member?');
assert.equal(valid?.confidence, 0.92);

const invalid = await requestNeoGuideLocalLanguageInterpretation(
  request,
  { enabled: true, endpoint: 'http://local/interpret', timeoutMs: 1200 },
  async () => ({
    ok: true,
    json: async () => ({ confidence: 4, rewrittenQuestion: 'bad' }),
  })
);
assert.equal(invalid, null, 'Invalid local model payload should be ignored.');

console.log('NEO Guide local language client tests passed.');
