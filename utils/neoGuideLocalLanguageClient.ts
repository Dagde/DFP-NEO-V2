import type {
  NeoGuideAnswer,
  NeoGuideConversationState,
  NeoGuidePageContext,
} from './neoGuideEngine';

export interface NeoGuideLocalLanguageConfig {
  enabled: boolean;
  endpoint: string;
  timeoutMs: number;
}

export interface NeoGuideLocalLanguageRequest {
  question: string;
  pageContext: Omit<NeoGuidePageContext, 'conversation'>;
  conversation: NeoGuideConversationState | null;
  deterministicAnswer: {
    intent: string;
    confidence: string;
    answer: string;
    topFunctionId?: string | null;
    topFunctionName?: string | null;
    needsClarification?: boolean;
  };
}

export interface NeoGuideLocalLanguageInterpretation {
  confidence: number;
  rewrittenQuestion?: string;
  intent?: string;
  concepts?: string[];
  entities?: Record<string, string>;
  clarificationQuestion?: string;
  requiresLiveData?: boolean;
}

type FetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 1200;
const MAX_TIMEOUT_MS = 2500;

function readViteEnv(): Record<string, string | undefined> {
  return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});
}

export function getNeoGuideLocalLanguageConfig(): NeoGuideLocalLanguageConfig {
  const env = readViteEnv();
  const endpoint = String(env.VITE_NEO_GUIDE_LOCAL_LANGUAGE_URL || '').trim();
  const timeoutDraft = Number(env.VITE_NEO_GUIDE_LOCAL_LANGUAGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutDraft)
    ? Math.max(250, Math.min(MAX_TIMEOUT_MS, timeoutDraft))
    : DEFAULT_TIMEOUT_MS;

  return {
    enabled: Boolean(endpoint),
    endpoint,
    timeoutMs,
  };
}

export function shouldUseNeoGuideLocalLanguage(
  question: string,
  answer: NeoGuideAnswer,
  config: NeoGuideLocalLanguageConfig = getNeoGuideLocalLanguageConfig()
): boolean {
  if (!config.enabled || !question.trim()) return false;
  if (answer.confidence === 'low') return true;
  if (answer.needsClarification) return true;
  if (/I don't know|couldn't match|not reliable enough/i.test(answer.answer)) return true;
  return false;
}

export function buildNeoGuideLocalLanguageRequest(
  question: string,
  answer: NeoGuideAnswer,
  context: NeoGuidePageContext
): NeoGuideLocalLanguageRequest {
  const topMatch = answer.matches[0];
  return {
    question,
    pageContext: {
      page: context.page,
      activeTab: context.activeTab,
      selectedRecordLabel: context.selectedRecordLabel,
      selectedRecordId: context.selectedRecordId,
      userPermissions: context.userPermissions,
    },
    conversation: context.conversation || null,
    deterministicAnswer: {
      intent: answer.intent,
      confidence: answer.confidence,
      answer: answer.answer,
      topFunctionId: topMatch?.functionId || null,
      topFunctionName: topMatch?.name || null,
      needsClarification: answer.needsClarification,
    },
  };
}

export async function requestNeoGuideLocalLanguageInterpretation(
  request: NeoGuideLocalLanguageRequest,
  config: NeoGuideLocalLanguageConfig = getNeoGuideLocalLanguageConfig(),
  fetchImpl: FetchLike = fetch
): Promise<NeoGuideLocalLanguageInterpretation | null> {
  if (!config.enabled) return null;

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return normaliseLocalLanguageInterpretation(payload);
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function normaliseLocalLanguageInterpretation(value: unknown): NeoGuideLocalLanguageInterpretation | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const confidence = Number(payload.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  const rewrittenQuestion = typeof payload.rewrittenQuestion === 'string'
    ? payload.rewrittenQuestion.trim().slice(0, 500)
    : undefined;
  const clarificationQuestion = typeof payload.clarificationQuestion === 'string'
    ? payload.clarificationQuestion.trim().slice(0, 300)
    : undefined;
  const intent = typeof payload.intent === 'string'
    ? payload.intent.trim().slice(0, 80)
    : undefined;
  const concepts = Array.isArray(payload.concepts)
    ? payload.concepts.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 80)).slice(0, 12)
    : undefined;
  const entities = payload.entities && typeof payload.entities === 'object' && !Array.isArray(payload.entities)
    ? Object.fromEntries(
      Object.entries(payload.entities as Record<string, unknown>)
        .filter(([, item]) => typeof item === 'string')
        .map(([key, item]) => [key.slice(0, 80), String(item).slice(0, 160)])
        .slice(0, 12)
    )
    : undefined;

  return {
    confidence,
    rewrittenQuestion,
    intent,
    concepts,
    entities,
    clarificationQuestion,
    requiresLiveData: Boolean(payload.requiresLiveData),
  };
}
