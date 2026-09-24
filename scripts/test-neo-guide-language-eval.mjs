import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerNeoGuideQuestion } from '../utils/neoGuideEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const model = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'neo-guide', 'dfp-neo-knowledge-model.json'), 'utf8'));
const evalSet = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'neo-guide', 'language-understanding-eval-set.json'), 'utf8'));

const ask = (question, context = {}) => answerNeoGuideQuestion(question, model, context);

for (const testCase of evalSet.cases || []) {
  const context = {};
  if (testCase.conversationSeedQuestion) {
    context.conversation = ask(testCase.conversationSeedQuestion).conversation;
  }
  const answer = ask(testCase.question, context);
  const actualFunctionId = answer.matches[0]?.functionId || null;

  if (testCase.expectedFunctionId) {
    assert.equal(
      actualFunctionId,
      testCase.expectedFunctionId,
      `${testCase.id}: expected ${testCase.expectedFunctionId}, got ${actualFunctionId}`
    );
  } else {
    assert.match(
      answer.answer,
      /I don't know|couldn't match|don't recognise/i,
      `${testCase.id}: expected a plain-English unknown/clarification answer.`
    );
  }

  for (const forbidden of testCase.mustNotMatch || []) {
    assert.notEqual(
      actualFunctionId,
      forbidden,
      `${testCase.id}: must not match ${forbidden}`
    );
  }

  if (testCase.expectedClarification) {
    assert.equal(answer.needsClarification, true, `${testCase.id}: expected clarification.`);
  }
}

console.log(`NEO Guide language eval passed: ${(evalSet.cases || []).length} cases.`);
