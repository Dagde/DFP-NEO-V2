import express from 'express';
import { fileURLToPath } from 'node:url';

const DEFAULT_SERVICE_HOST = '127.0.0.1';
const DEFAULT_SERVICE_PORT = 8765;
const DEFAULT_MODEL_URL = 'http://127.0.0.1:8080/v1/chat/completions';
const DEFAULT_MODEL_NAME = 'granite-4.2-8b';
const DEFAULT_TIMEOUT_MS = 1800;
const MAX_TIMEOUT_MS = 8000;
const MAX_REQUEST_BYTES = '64kb';
const LOCAL_MODEL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function normaliseServiceConfig(env = process.env) {
  const portDraft = Number(env.NEO_GUIDE_SERVICE_PORT || DEFAULT_SERVICE_PORT);
  const timeoutDraft = Number(env.NEO_GUIDE_INFERENCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    serviceHost: String(env.NEO_GUIDE_SERVICE_HOST || DEFAULT_SERVICE_HOST).trim() || DEFAULT_SERVICE_HOST,
    servicePort: Number.isFinite(portDraft) ? portDraft : DEFAULT_SERVICE_PORT,
    modelUrl: String(env.NEO_GUIDE_LLAMACPP_URL || DEFAULT_MODEL_URL).trim(),
    modelName: String(env.NEO_GUIDE_MODEL_NAME || DEFAULT_MODEL_NAME).trim() || DEFAULT_MODEL_NAME,
    timeoutMs: Number.isFinite(timeoutDraft)
      ? Math.max(250, Math.min(MAX_TIMEOUT_MS, timeoutDraft))
      : DEFAULT_TIMEOUT_MS,
    allowedOrigin: String(env.NEO_GUIDE_ALLOWED_ORIGIN || '').trim(),
    allowNonLocalModel: env.NEO_GUIDE_ALLOW_NONLOCAL_MODEL === '1',
  };
}

export function isAllowedLocalModelUrl(urlText, allowNonLocalModel = false) {
  try {
    const url = new URL(urlText);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (allowNonLocalModel) return true;
    return LOCAL_MODEL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normaliseStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseEntities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entityValue]) => typeof entityValue === 'string')
      .map(([key, entityValue]) => [cleanText(key, 80), cleanText(entityValue, 160)])
      .filter(([key, entityValue]) => key && entityValue)
      .slice(0, 12)
  );
}

export function normaliseLanguageRequest(value) {
  if (!value || typeof value !== 'object') return null;
  const payload = value;
  const question = cleanText(payload.question, 500);
  if (!question) return null;

  const deterministicAnswer = payload.deterministicAnswer && typeof payload.deterministicAnswer === 'object'
    ? payload.deterministicAnswer
    : {};
  const pageContext = payload.pageContext && typeof payload.pageContext === 'object'
    ? payload.pageContext
    : {};
  const conversation = payload.conversation && typeof payload.conversation === 'object'
    ? payload.conversation
    : null;

  return {
    question,
    pageContext: {
      page: cleanText(pageContext.page, 120),
      activeTab: cleanText(pageContext.activeTab, 120),
      selectedRecordLabel: cleanText(pageContext.selectedRecordLabel, 160),
      selectedRecordId: cleanText(pageContext.selectedRecordId, 120),
      userPermissions: normaliseStringArray(pageContext.userPermissions, 50, 120),
    },
    conversation: conversation
      ? {
        topic: cleanText(conversation.topic, 160),
        intent: cleanText(conversation.intent, 80),
        page: cleanText(conversation.page, 120),
        entityLabel: cleanText(conversation.entityLabel, 160),
      }
      : null,
    deterministicAnswer: {
      intent: cleanText(deterministicAnswer.intent, 80),
      confidence: cleanText(deterministicAnswer.confidence, 40),
      answer: cleanText(deterministicAnswer.answer, 1200),
      topFunctionId: cleanText(deterministicAnswer.topFunctionId, 160),
      topFunctionName: cleanText(deterministicAnswer.topFunctionName, 160),
      needsClarification: Boolean(deterministicAnswer.needsClarification),
    },
  };
}

export function buildInterpretationPrompt(request) {
  const context = [
    `Question: ${request.question}`,
    `Current page: ${request.pageContext.page || 'unknown'}`,
    `Active tab: ${request.pageContext.activeTab || 'unknown'}`,
    `Selected record: ${request.pageContext.selectedRecordLabel || 'none'}`,
    `Conversation topic: ${request.conversation?.topic || 'none'}`,
    `Previous intent: ${request.conversation?.intent || 'none'}`,
    `Deterministic intent: ${request.deterministicAnswer.intent || 'unknown'}`,
    `Deterministic confidence: ${request.deterministicAnswer.confidence || 'unknown'}`,
    `Deterministic top match: ${request.deterministicAnswer.topFunctionName || 'none'}`,
    `Deterministic answer summary: ${request.deterministicAnswer.answer || 'none'}`,
  ].join('\n');

  return [
    'You interpret naturally worded DFP-NEO user questions for a local application guide.',
    'Return only valid JSON. Do not answer the user question. Do not invent DFP-NEO facts.',
    'Your task is to rewrite or clarify what the user probably meant so the deterministic DFP-NEO guide can answer from its own verified knowledge.',
    'If the user is asking a follow-up, use the conversation context only when it clearly applies. If the new question changes topic, follow the new question.',
    'Use everyday wording. Do not return implementation names, component names, file names, source-code labels, or technical jargon.',
    'Schema:',
    '{"confidence":0.0,"rewrittenQuestion":"","intent":"","concepts":[],"entities":{},"clarificationQuestion":"","requiresLiveData":false}',
    'Allowed intents include FIND, NAVIGATE, HOW_TO, EXPLAIN, DEFINE, TROUBLESHOOT, WHY, WHAT_IF, COMPARE, DATA_LOCATION, PERMISSION, BUSINESS_RULE, SCHEDULING_LOGIC, VALIDATION, REPORTING, EXPORT, SETTINGS.',
    'Set confidence between 0 and 1. Only set clarificationQuestion if a short clarification is genuinely needed.',
    '',
    context,
  ].join('\n');
}

export function extractJsonObject(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

export function normaliseInterpretation(value) {
  if (!value || typeof value !== 'object') return null;
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  const rewrittenQuestion = cleanText(value.rewrittenQuestion, 500);
  const clarificationQuestion = cleanText(value.clarificationQuestion, 300);
  const intent = cleanText(value.intent, 80);
  const concepts = normaliseStringArray(value.concepts, 12, 80);
  const entities = normaliseEntities(value.entities);

  if (!rewrittenQuestion && !clarificationQuestion && concepts.length === 0) return null;

  return {
    confidence,
    rewrittenQuestion: rewrittenQuestion || undefined,
    intent: intent || undefined,
    concepts: concepts.length ? concepts : undefined,
    entities: Object.keys(entities).length ? entities : undefined,
    clarificationQuestion: clarificationQuestion || undefined,
    requiresLiveData: Boolean(value.requiresLiveData),
  };
}

export async function callLocalModel(request, config, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(config.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a local DFP-NEO language interpreter. Return only valid JSON for the requested schema.',
          },
          {
            role: 'user',
            content: buildInterpretationPrompt(request),
          },
        ],
        temperature: 0,
        max_tokens: 400,
        stream: false,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`Local model returned HTTP ${response.status}`);
      error.statusCode = 502;
      throw error;
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const json = extractJsonObject(content);
    const interpretation = normaliseInterpretation(json);
    if (!interpretation) {
      const error = new Error('Local model returned invalid interpretation JSON');
      error.statusCode = 502;
      throw error;
    }
    return interpretation;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Local model request timed out');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function originIsAllowed(origin, config) {
  if (!origin) return true;
  if (config.allowedOrigin && origin === config.allowedOrigin) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function applyCors(req, res, config) {
  const origin = req.headers.origin;
  if (originIsAllowed(origin, config)) {
    res.setHeader('Access-Control-Allow-Origin', origin || config.allowedOrigin || 'http://localhost:5173');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
}

export function createNeoGuideLocalLanguageService(config = normaliseServiceConfig(), fetchImpl = fetch) {
  if (!isAllowedLocalModelUrl(config.modelUrl, config.allowNonLocalModel)) {
    throw new Error('NEO_GUIDE_LLAMACPP_URL must point to localhost unless NEO_GUIDE_ALLOW_NONLOCAL_MODEL=1 is explicitly set.');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: MAX_REQUEST_BYTES }));
  app.use((req, res, next) => {
    applyCors(req, res, config);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      modelName: config.modelName,
      modelUrlHost: new URL(config.modelUrl).host,
      timeoutMs: config.timeoutMs,
    });
  });

  app.post('/interpret', async (req, res) => {
    if (!originIsAllowed(req.headers.origin, config)) {
      res.status(403).json({ error: 'origin_not_allowed' });
      return;
    }

    const request = normaliseLanguageRequest(req.body);
    if (!request) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    try {
      const interpretation = await callLocalModel(request, config, fetchImpl);
      res.json(interpretation);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 502;
      res.status(statusCode).json({ error: statusCode === 504 ? 'model_timeout' : 'model_unavailable' });
    }
  });

  return app;
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryPoint) {
  const config = normaliseServiceConfig();
  const app = createNeoGuideLocalLanguageService(config);
  app.listen(config.servicePort, config.serviceHost, () => {
    console.log(`NEO Guide local language service listening on http://${config.serviceHost}:${config.servicePort}`);
    console.log(`Forwarding interpretation requests to ${config.modelUrl}`);
  });
}
