import assert from 'node:assert/strict';
import {
  buildInterpretationPrompt,
  callLocalModel,
  createNeoGuideLocalLanguageService,
  extractJsonObject,
  isAllowedLocalModelUrl,
  normaliseInterpretation,
  normaliseLanguageRequest,
  normaliseServiceConfig,
} from './neo-guide-local-language-service.mjs';

assert.equal(isAllowedLocalModelUrl('http://127.0.0.1:8080/v1/chat/completions'), true);
assert.equal(isAllowedLocalModelUrl('http://localhost:8080/v1/chat/completions'), true);
assert.equal(isAllowedLocalModelUrl('https://example.com/v1/chat/completions'), false);
assert.equal(isAllowedLocalModelUrl('https://example.com/v1/chat/completions', true), true);
assert.equal(isAllowedLocalModelUrl('file:///tmp/model'), false);

const config = normaliseServiceConfig({
  NEO_GUIDE_SERVICE_PORT: '9001',
  NEO_GUIDE_LLAMACPP_URL: 'http://127.0.0.1:8080/v1/chat/completions',
  NEO_GUIDE_MODEL_NAME: 'granite-4.2-8b-test',
  NEO_GUIDE_INFERENCE_TIMEOUT_MS: '999999',
});
assert.equal(config.servicePort, 9001);
assert.equal(config.modelName, 'granite-4.2-8b-test');
assert.equal(config.timeoutMs, 8000, 'Timeout should be capped.');

const request = normaliseLanguageRequest({
  question: 'how do I auth a flight?',
  pageContext: {
    page: 'DFP',
    activeTab: 'Timeline',
    selectedRecordLabel: 'BGF12',
    userPermissions: ['dfp.view', 'duty-pilot.view'],
  },
  conversation: {
    topic: 'flight authorisation',
    intent: 'HOW_TO',
    page: 'Duty Pilot',
    entityLabel: 'BGF12',
  },
  deterministicAnswer: {
    intent: 'HOW_TO',
    confidence: 'low',
    answer: 'Opens the main DFP timeline.',
    topFunctionName: 'Open the DFP schedule',
    needsClarification: true,
  },
});
assert.equal(request.question, 'how do I auth a flight?');
assert.equal(request.pageContext.userPermissions.length, 2);

const prompt = buildInterpretationPrompt(request);
assert.match(prompt, /Return only valid JSON/);
assert.match(prompt, /Do not answer the user question/);
assert.match(prompt, /how do I auth a flight/);
assert.match(prompt, /Do not return implementation names, component names, file names, source-code labels/i);

const fenced = extractJsonObject('```json\n{"confidence":0.8,"rewrittenQuestion":"How do I authorise a flight?"}\n```');
assert.equal(fenced.rewrittenQuestion, 'How do I authorise a flight?');
const surrounded = extractJsonObject('Here is JSON: {"confidence":0.7,"concepts":["staff"]} thanks');
assert.deepEqual(surrounded.concepts, ['staff']);

const interpretation = normaliseInterpretation({
  confidence: 0.91,
  rewrittenQuestion: 'How do I authorise a flight from the DFP tile?',
  intent: 'HOW_TO',
  concepts: ['flight authorisation', 'DFP tile'],
  entities: { method: 'DFP tile' },
  requiresLiveData: false,
});
assert.equal(interpretation.rewrittenQuestion, 'How do I authorise a flight from the DFP tile?');
assert.equal(interpretation.entities.method, 'DFP tile');
assert.equal(normaliseInterpretation({ confidence: 4, rewrittenQuestion: 'bad' }), null);
assert.equal(normaliseInterpretation({ confidence: 0.5 }), null);

const modelResponse = await callLocalModel(
  request,
  {
    modelUrl: 'http://127.0.0.1:8080/v1/chat/completions',
    modelName: 'granite-4.2-8b-test',
    timeoutMs: 1000,
  },
  async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'granite-4.2-8b-test');
    assert.equal(body.temperature, 0);
    assert.equal(body.response_format.type, 'json_object');
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.88,
                rewrittenQuestion: 'How do I authorise a flight?',
                intent: 'HOW_TO',
                concepts: ['flight authorisation'],
                entities: {},
                requiresLiveData: false,
              }),
            },
          },
        ],
      }),
    };
  }
);
assert.equal(modelResponse.rewrittenQuestion, 'How do I authorise a flight?');

const app = createNeoGuideLocalLanguageService(
  {
    serviceHost: '127.0.0.1',
    servicePort: 0,
    modelUrl: 'http://127.0.0.1:8080/v1/chat/completions',
    modelName: 'granite-4.2-8b-test',
    timeoutMs: 1000,
    allowedOrigin: 'http://localhost:5173',
    allowNonLocalModel: false,
  },
  async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: '{"confidence":0.9,"rewrittenQuestion":"How do I authorise a flight from the DFP tile?","intent":"HOW_TO","concepts":["flight authorisation"],"entities":{"method":"DFP tile"},"requiresLiveData":false}',
          },
        },
      ],
    }),
  })
);

const server = await new Promise((resolve) => {
  const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
});
try {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/interpret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify(request),
  });
  assert.equal(response.ok, true);
  const payload = await response.json();
  assert.equal(payload.rewrittenQuestion, 'How do I authorise a flight from the DFP tile?');
} finally {
  await new Promise((resolve) => server.close(resolve));
}

assert.throws(
  () => createNeoGuideLocalLanguageService({
    serviceHost: '127.0.0.1',
    servicePort: 0,
    modelUrl: 'https://example.com/v1/chat/completions',
    modelName: 'remote',
    timeoutMs: 1000,
    allowedOrigin: '',
    allowNonLocalModel: false,
  }),
  /localhost/
);

console.log('NEO Guide local language service tests passed.');
