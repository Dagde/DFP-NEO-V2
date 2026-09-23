export type NeoGuideIntent =
  | 'FIND'
  | 'NAVIGATE'
  | 'HOW_TO'
  | 'EXPLAIN'
  | 'DEFINE'
  | 'TROUBLESHOOT'
  | 'WHY'
  | 'DATA_LOCATION'
  | 'PERMISSION'
  | 'BUSINESS_RULE'
  | 'SCHEDULING_LOGIC'
  | 'VALIDATION'
  | 'REPORTING'
  | 'EXPORT'
  | 'SETTINGS'
  | 'UNKNOWN';

export interface NeoGuideLocation {
  page?: string | null;
  route?: string | null;
  component?: string | null;
  anchor?: string | null;
  line?: number | null;
}

export interface NeoGuideFunction {
  id: string;
  name: string;
  aliases?: string[];
  location?: NeoGuideLocation;
  purpose?: string;
  inputs?: unknown[];
  outputs?: string[];
  permissions?: string[];
  dependencies?: string[];
  businessRules?: string[];
  failureConditions?: string[];
  relatedFunctions?: string[];
  auditStatus?: string;
}

export interface NeoGuideSynonymGroup {
  canonical: string;
  terms: string[];
}

export interface NeoGuideRuntimeModel {
  curatedKnowledge?: {
    functions?: NeoGuideFunction[];
    synonyms?: NeoGuideSynonymGroup[];
  };
  functions?: NeoGuideFunction[];
  guideTargets?: Array<{ id: string; file?: string; line?: number; tagName?: string }>;
}

export interface NeoGuidePageContext {
  page?: string;
  activeTab?: string;
  selectedRecordLabel?: string;
  selectedRecordId?: string;
  userPermissions?: string[];
}

export interface NeoGuideNavigationAction {
  label: string;
  page?: string | null;
  route?: string | null;
  anchor?: string | null;
  highlightTarget?: string | null;
}

export interface NeoGuideMatch {
  functionId: string;
  name: string;
  score: number;
  location?: NeoGuideLocation;
  permissions: string[];
  reasons: string[];
  function: NeoGuideFunction;
}

export interface NeoGuideAnswer {
  intent: NeoGuideIntent;
  entities: string[];
  confidence: 'high' | 'medium' | 'low';
  answer: string;
  matches: NeoGuideMatch[];
  navigationAction?: NeoGuideNavigationAction;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for', 'from', 'get', 'go',
  'has', 'have', 'he', 'her', 'him', 'his', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of',
  'on', 'or', 'our', 'she', 'that', 'the', 'their', 'there', 'this', 'to', 'turn', 'up',
  'we', 'what', 'when', 'where', 'who', 'why', 'with', 'you'
]);

const INTENT_PATTERNS: Array<{ intent: NeoGuideIntent; patterns: RegExp[] }> = [
  { intent: 'WHY', patterns: [/\bwhy\b/, /\bwhy\s+(?:is|are|did|didn'?t|was|wasn'?t)\b/] },
  { intent: 'HOW_TO', patterns: [/\bhow\s+(?:do|can|would|to)\b/, /\bsteps?\b/, /\bprocedure\b/] },
  { intent: 'NAVIGATE', patterns: [/\bwhere\b/, /\bopen\b/, /\bshow\b/, /\btake me\b/, /\bgo to\b/] },
  { intent: 'FIND', patterns: [/\bfind\b/, /\blocate\b/, /\bsearch\b/] },
  { intent: 'DEFINE', patterns: [/\bwhat\s+is\b/, /\bwhat'?s\b/, /\bdefine\b/, /\bmeaning\b/] },
  { intent: 'TROUBLESHOOT', patterns: [/\bcan'?t\b/, /\bcannot\b/, /\bnot working\b/, /\bmissing\b/, /\bblank\b/, /\bempty\b/, /\bunavailable\b/] },
  { intent: 'PERMISSION', patterns: [/\bpermission\b/, /\baccess\b/, /\bgreyed out\b/, /\bdisabled\b/, /\bunavailable button\b/] },
  { intent: 'SCHEDULING_LOGIC', patterns: [/\bschedule\b/, /\bscheduled\b/, /\bbuild\b/, /\ballocat/, /\bpriority\b/] },
  { intent: 'SETTINGS', patterns: [/\bsetting\b/, /\bconfigure\b/, /\bchange\b/] },
  { intent: 'EXPORT', patterns: [/\bexport\b/, /\bdownload\b/, /\bcsv\b/, /\breport\b/] },
  { intent: 'VALIDATION', patterns: [/\bvalidation\b/, /\bwarning\b/, /\bconflict\b/, /\berror\b/] },
  { intent: 'REPORTING', patterns: [/\breport\b/, /\btrg rep\b/, /\btraining record\b/, /\bgrade\b/] },
  { intent: 'BUSINESS_RULE', patterns: [/\brule\b/, /\blimit\b/, /\bconstraint\b/, /\bturnaround\b/, /\bturnround\b/] },
  { intent: 'DATA_LOCATION', patterns: [/\bstored\b/, /\bsaved\b/, /\bdata\b/, /\bdatabase\b/] }
];

const INTENT_HINTS: Record<NeoGuideIntent, string[]> = {
  FIND: ['find', 'locate', 'where'],
  NAVIGATE: ['open', 'show', 'page', 'button', 'navigate'],
  HOW_TO: ['how', 'add', 'make', 'change', 'configure', 'archive', 'upload', 'enter'],
  EXPLAIN: ['explain', 'mean', 'why'],
  DEFINE: ['what', 'define', 'meaning'],
  TROUBLESHOOT: ['missing', 'blank', 'empty', 'cannot', 'cant', 'disabled', 'unavailable', 'not working'],
  WHY: ['why', 'reason', 'because'],
  DATA_LOCATION: ['stored', 'saved', 'data', 'database'],
  PERMISSION: ['permission', 'access', 'role', 'disabled', 'greyed'],
  BUSINESS_RULE: ['rule', 'limit', 'constraint', 'turnaround', 'turnround'],
  SCHEDULING_LOGIC: ['schedule', 'scheduled', 'build', 'allocation', 'priority', 'eligible'],
  VALIDATION: ['validation', 'warning', 'conflict', 'error'],
  REPORTING: ['report', 'grade', 'score', 'ranking', 'trg'],
  EXPORT: ['export', 'download', 'csv', 'print'],
  SETTINGS: ['setting', 'settings', 'configure', 'configuration'],
  UNKNOWN: []
};

export function answerNeoGuideQuestion(
  question: string,
  model: NeoGuideRuntimeModel,
  context: NeoGuidePageContext = {}
): NeoGuideAnswer {
  const interpretation = interpretNeoGuideQuestion(question, model, context);
  const [best, second] = interpretation.matches;

  if (!best) {
    return {
      ...interpretation,
      confidence: 'low',
      answer: "I couldn't match that to a DFP-NEO function yet. Try naming the page, person, course, setting or action you are asking about.",
      needsClarification: true,
      clarificationQuestion: 'Which DFP-NEO area are you asking about?'
    };
  }

  const confidence = best.score >= 22 ? 'high' : best.score >= 12 ? 'medium' : 'low';
  if (confidence === 'low' || (second && best.score - second.score < 3)) {
    return {
      ...interpretation,
      confidence,
      answer: `I found a possible match: ${best.name}. I may need a little more context before giving a firm answer.`,
      navigationAction: buildNavigationAction(best),
      needsClarification: true,
      clarificationQuestion: `Do you mean ${best.name}${second ? ` or ${second.name}` : ''}?`
    };
  }

  return {
    ...interpretation,
    confidence,
    answer: buildAnswerText(interpretation.intent, best),
    navigationAction: buildNavigationAction(best)
  };
}

export function interpretNeoGuideQuestion(
  question: string,
  model: NeoGuideRuntimeModel,
  context: NeoGuidePageContext = {}
): Omit<NeoGuideAnswer, 'answer' | 'confidence' | 'navigationAction'> & { matches: NeoGuideMatch[] } {
  const intent = detectIntent(question);
  const synonymMap = buildSynonymMap(model.curatedKnowledge?.synonyms || []);
  const tokens = expandTokens(tokenize(question), synonymMap);
  const normalisedQuestion = normalise(question);
  const entities = extractLikelyEntities(question, tokens);
  const userPermissions = new Set(context.userPermissions || []);
  const sourceFunctions = [
    ...(model.curatedKnowledge?.functions || []),
    ...(model.functions || []).filter((fn) => !String(fn.id || '').startsWith('function.curated.'))
  ];

  const matches = sourceFunctions
    .map((fn) => scoreFunction(fn, tokens, normalisedQuestion, intent, context, userPermissions))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  return {
    intent,
    entities,
    matches,
    needsClarification: false
  };
}

export function detectIntent(question: string): NeoGuideIntent {
  const normalised = normalise(question);
  for (const candidate of INTENT_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(normalised))) return candidate.intent;
  }
  return 'UNKNOWN';
}

function scoreFunction(
  fn: NeoGuideFunction,
  tokens: string[],
  normalisedQuestion: string,
  intent: NeoGuideIntent,
  context: NeoGuidePageContext,
  userPermissions: Set<string>
): NeoGuideMatch {
  const haystackParts = [
    fn.name,
    ...(fn.aliases || []),
    fn.purpose,
    ...(fn.outputs || []),
    ...(fn.dependencies || []),
    ...(fn.businessRules || []),
    ...(fn.failureConditions || []),
    fn.location?.page,
    fn.location?.anchor
  ].filter(Boolean).map(String);
  const haystack = normalise(haystackParts.join(' '));
  const haystackTokens = new Set(tokenize(haystack));
  const reasons: string[] = [];
  let score = 0;

  const exactPhrases = [fn.name, ...(fn.aliases || [])]
    .map((value) => normalise(String(value || '')))
    .filter((value) => value.length >= 4);
  const questionTokens = new Set(tokenize(normalisedQuestion));
  for (const phrase of exactPhrases) {
    if (normalisedQuestion.includes(phrase)) {
      score += phrase === normalise(fn.name) ? 8 : 6;
      reasons.push(`phrase ${phrase}`);
      break;
    }
    const phraseTokens = tokenize(phrase);
    if (phraseTokens.length > 1 && phraseTokens.every((token) => questionTokens.has(token))) {
      score += phrase === normalise(fn.name) ? 7 : 5;
      reasons.push(`phrase tokens ${phrase}`);
      break;
    }
  }

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    if (haystackTokens.has(token)) {
      score += 4;
      reasons.push(`matched ${token}`);
      continue;
    }
    if (token.length >= 5 && haystack.includes(token)) {
      score += 2;
      reasons.push(`partial ${token}`);
      continue;
    }
    if (token.length >= 5 && hasNearToken(token, haystackTokens)) {
      score += 1.5;
      reasons.push(`near ${token}`);
    }
  }

  const intentHints = INTENT_HINTS[intent] || [];
  if (intentHints.some((hint) => haystack.includes(hint))) {
    score += 3;
    reasons.push(`intent ${intent}`);
  }

  if (context.page && fn.location?.page && normalise(context.page) === normalise(fn.location.page)) {
    score += 3;
    reasons.push('current page');
  }

  const permissions = fn.permissions || [];
  if (permissions.length > 0 && userPermissions.size > 0) {
    const hasAnyPermission = permissions.some((permission) => userPermissions.has(permission));
    score += hasAnyPermission ? 1 : -2;
    reasons.push(hasAnyPermission ? 'permission visible' : 'permission may be restricted');
  }

  if (String(fn.id || '').startsWith('function.curated.') || fn.auditStatus?.includes('manually enriched') || fn.auditStatus?.includes('manually')) {
    score += 6;
    reasons.push('curated');
  }

  return {
    functionId: fn.id,
    name: fn.name,
    score,
    location: fn.location,
    permissions,
    reasons: Array.from(new Set(reasons)).slice(0, 8),
    function: fn
  };
}

function buildAnswerText(intent: NeoGuideIntent, match: NeoGuideMatch): string {
  const fn = match.function;
  const location = fn.location?.page ? ` Open ${fn.location.page}` : '';
  const purpose = fn.purpose || `${fn.name} is a DFP-NEO function.`;
  const dependency = first(fn.dependencies);
  const failure = first(fn.failureConditions);
  const rule = first(fn.businessRules);

  if (intent === 'WHY' || intent === 'TROUBLESHOOT') {
    const reasons = [failure, rule, dependency].filter(Boolean);
    return reasons.length > 0
      ? `${purpose} The most relevant checks are: ${reasons.join(' ')}${location ? ` ${location} to review it.` : ''}`
      : `${purpose}${location ? ` ${location} to review it.` : ''}`;
  }

  if (intent === 'NAVIGATE' || intent === 'FIND') {
    return `${fn.name} is in ${fn.location?.page || 'DFP-NEO'}.${fn.location?.anchor ? ' I can take you to the relevant control or section.' : ''}`;
  }

  if (intent === 'HOW_TO') {
    return `${purpose}${location ? ` Start from ${fn.location?.page}.` : ''}${rule ? ` ${rule}` : ''}`;
  }

  if (intent === 'PERMISSION') {
    const permissionText = match.permissions.length > 0 ? match.permissions.join(', ') : 'the relevant page permission';
    return `${fn.name} is controlled by ${permissionText}. If it is disabled, check the user role and permission profile for that function.`;
  }

  return `${purpose}${location ? ` ${location} for the relevant controls.` : ''}`;
}

function buildNavigationAction(match: NeoGuideMatch): NeoGuideNavigationAction | undefined {
  const location = match.location;
  if (!location?.page && !location?.route && !location?.anchor) return undefined;
  return {
    label: location?.anchor ? `Open ${match.name}` : `Open ${location.page || match.name}`,
    page: location?.page || null,
    route: location?.route || null,
    anchor: location?.anchor || null,
    highlightTarget: location?.anchor || null
  };
}

function tokenize(value: string): string[] {
  return normalise(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandTokens(tokens: string[], synonymMap: Map<string, string>): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    const canonical = synonymMap.get(token);
    if (canonical) {
      tokenize(canonical).forEach((canonicalToken) => expanded.add(canonicalToken));
    }
  }
  return Array.from(expanded);
}

function buildSynonymMap(groups: NeoGuideSynonymGroup[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    const canonical = normalise(group.canonical);
    tokenize(group.canonical).forEach((token) => map.set(token, canonical));
    for (const term of group.terms || []) {
      const termTokens = tokenize(term);
      if (termTokens.length === 1) map.set(termTokens[0], canonical);
    }
  }
  return map;
}

function extractLikelyEntities(question: string, tokens: string[]): string[] {
  const entities = new Set<string>();
  for (const match of question.matchAll(/\b[A-Z][A-Z0-9]{2,}\b/g)) entities.add(match[0]);
  for (const match of question.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)) entities.add(match[0]);
  for (const token of tokens) {
    if (/[a-z]+\d+/.test(token) || /\d/.test(token)) entities.add(token.toUpperCase());
  }
  return Array.from(entities).slice(0, 8);
}

function hasNearToken(token: string, haystackTokens: Set<string>): boolean {
  for (const candidate of haystackTokens) {
    if (Math.abs(candidate.length - token.length) > 2) continue;
    if (levenshteinDistance(token, candidate) <= 2) return true;
  }
  return false;
}

function levenshteinDistance(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
    }
  }
  return matrix[left.length][right.length];
}

function normalise(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(values?: string[]): string {
  return Array.isArray(values) && values.length > 0 ? values[0] : '';
}
