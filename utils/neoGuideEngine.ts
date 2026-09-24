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
  procedureSteps?: string[];
  workflowOptions?: Array<{
    name: string;
    aliases?: string[];
    summary?: string;
    procedureSteps?: string[];
    anchor?: string | null;
    page?: string | null;
  }>;
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
  terminologyIndex?: Array<{ term: string; normalised?: string; aliases?: string[]; sources?: string[]; count?: number }>;
  guideTargets?: Array<{ id: string; file?: string; line?: number; tagName?: string }>;
}

export interface NeoGuidePageContext {
  page?: string;
  activeTab?: string;
  selectedRecordLabel?: string;
  selectedRecordId?: string;
  userPermissions?: string[];
  conversation?: NeoGuideConversationState | null;
}

export interface NeoGuideConversationState {
  topic?: string;
  lastFunctionId?: string;
  lastFunctionName?: string;
  lastIntent?: NeoGuideIntent;
  lastEntities?: string[];
  awaitingWorkflowChoice?: boolean;
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
  conversation: NeoGuideConversationState;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for', 'from', 'get', 'go',
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

const ACTION_FAMILIES: Array<{ name: string; terms: string[] }> = [
  { name: 'delete', terms: ['delete', 'deleted', 'deleting', 'remove', 'removed', 'removing', 'permanent', 'permanently'] },
  { name: 'archive', terms: ['archive', 'archived', 'retire', 'retired', 'restore', 'restored'] },
  { name: 'unavailable', terms: ['unavailable', 'unavailability', 'leave', 'away', 'pause', 'paused', 'blocked'] },
  { name: 'add', terms: ['add', 'create', 'new', 'insert', 'upload', 'import'] },
  { name: 'edit', terms: ['edit', 'change', 'update', 'modify', 'configure', 'set'] },
];
const LOW_SIGNAL_MATCH_TOKENS = new Set(['action', 'button', 'control', 'field', 'page', 'panel', 'section', 'setting', 'settings', 'override']);

export function answerNeoGuideQuestion(
  question: string,
  model: NeoGuideRuntimeModel,
  context: NeoGuidePageContext = {}
): NeoGuideAnswer {
  const pendingWorkflowAnswer = answerPendingWorkflowChoice(question, model, context);
  if (pendingWorkflowAnswer) return pendingWorkflowAnswer;

  const interpretation = interpretNeoGuideQuestion(question, model, context);
  const [best, second] = interpretation.matches;
  const nextConversation = buildNextConversationState(best, interpretation.intent, interpretation.entities, context.conversation);

  if (!best) {
    return {
      ...interpretation,
      confidence: 'low',
      answer: "I couldn't match that to a DFP-NEO function yet. Try naming the page, person, course, setting or action you are asking about.",
      conversation: nextConversation,
      needsClarification: true,
      clarificationQuestion: 'Which DFP-NEO area are you asking about?'
    };
  }

  const confidence = best.score >= 22 ? 'high' : best.score >= 12 ? 'medium' : 'low';
  if (isThinGeneratedImplementationMatch(best)) {
    return {
      ...interpretation,
      confidence: 'low',
      answer: "I don't know the answer to that yet. I couldn't find a reliable DFP-NEO guide entry for that question.",
      conversation: nextConversation,
      needsClarification: true,
      clarificationQuestion: 'Try asking it another way, or name the page and action you are using.'
    };
  }

  const workflowOption = selectWorkflowOption(best.function, question);
  if (hasWorkflowOptions(best.function) && !workflowOption && (interpretation.intent === 'HOW_TO' || interpretation.intent === 'NAVIGATE' || interpretation.intent === 'UNKNOWN')) {
    return {
      ...interpretation,
      confidence,
      answer: buildWorkflowChoiceText(best.function),
      conversation: { ...nextConversation, awaitingWorkflowChoice: true },
      needsClarification: true
    };
  }

  if (confidence === 'low') {
    return {
      ...interpretation,
      confidence,
      answer: "I don't know the answer to that yet. I found a possible match, but it is not reliable enough to give you instructions.",
      navigationAction: buildNavigationAction(best),
      conversation: nextConversation,
      needsClarification: true,
      clarificationQuestion: `Do you mean ${best.name}${second ? ` or ${second.name}` : ''}?`
    };
  }

  if (second && best.score - second.score < 3) {
    return {
      ...interpretation,
      confidence,
      answer: buildAnswerText(interpretation.intent, best),
      navigationAction: buildNavigationAction(best),
      conversation: nextConversation,
      needsClarification: true,
      clarificationQuestion: `Do you mean ${best.name}${second ? ` or ${second.name}` : ''}?`
    };
  }

  return {
    ...interpretation,
    confidence,
    answer: buildAnswerText(interpretation.intent, best, workflowOption),
    navigationAction: buildNavigationAction(best, workflowOption),
    conversation: nextConversation
  };
}

function answerPendingWorkflowChoice(
  question: string,
  model: NeoGuideRuntimeModel,
  context: NeoGuidePageContext
): NeoGuideAnswer | null {
  if (!context.conversation?.awaitingWorkflowChoice || !context.conversation.lastFunctionId) return null;
  const functions = [
    ...(model.curatedKnowledge?.functions || []),
    ...(model.functions || [])
  ];
  const fn = functions.find((candidate) => candidate.id === context.conversation?.lastFunctionId);
  if (!fn || !hasWorkflowOptions(fn)) return null;
  const workflowOption = selectWorkflowOption(fn, question);
  if (!workflowOption) {
    return {
      intent: 'UNKNOWN',
      entities: extractLikelyEntities(question, tokenize(question)),
      confidence: 'low',
      answer: `I don't recognise that method yet.\n\n${buildWorkflowChoiceText(fn)}`,
      matches: [{
        functionId: fn.id,
        name: fn.name,
        score: 0,
        location: fn.location,
        permissions: fn.permissions || [],
        reasons: ['awaiting workflow choice'],
        function: fn,
      }],
      conversation: {
        ...context.conversation,
        awaitingWorkflowChoice: true,
      },
      needsClarification: true,
    };
  }
  const match: NeoGuideMatch = {
    functionId: fn.id,
    name: fn.name,
    score: 30,
    location: fn.location,
    permissions: fn.permissions || [],
    reasons: ['selected workflow option'],
    function: fn,
  };
  return {
    intent: 'HOW_TO',
    entities: extractLikelyEntities(question, tokenize(question)),
    confidence: 'high',
    answer: buildAnswerText('HOW_TO', match, workflowOption),
    matches: [match],
    navigationAction: buildNavigationAction(match, workflowOption),
    conversation: {
      topic: [fn.name, workflowOption.name].join(' '),
      lastFunctionId: fn.id,
      lastFunctionName: fn.name,
      lastIntent: 'HOW_TO',
      lastEntities: [],
      awaitingWorkflowChoice: false,
    },
  };
}

function isThinGeneratedImplementationMatch(match: NeoGuideMatch): boolean {
  const fn = match.function;
  const isCurated = String(fn.id || '').startsWith('function.curated.')
    || String(fn.auditStatus || '').toLowerCase().includes('manual');
  if (isCurated) return false;
  const text = normalise([
    fn.name,
    fn.purpose,
    fn.auditStatus,
    fn.location?.component,
  ].filter(Boolean).join(' '));
  if (/manual enrichment/.test(text)) return true;
  if (/\b(app|component|tsx|jsx|ts|js)\b/.test(text) && /\b(control|button|input|select)\b/.test(text) && !fn.procedureSteps?.length) return true;
  return false;
}

export function interpretNeoGuideQuestion(
  question: string,
  model: NeoGuideRuntimeModel,
  context: NeoGuidePageContext = {}
): Omit<NeoGuideAnswer, 'answer' | 'confidence' | 'navigationAction' | 'conversation'> & { matches: NeoGuideMatch[] } {
  const intent = detectIntent(question);
  const synonymMap = buildSynonymMap(model.curatedKnowledge?.synonyms || [], model.terminologyIndex || []);
  const rawTokens = tokenize(question);
  const contextTokens = getConversationContextTokens(question, context.conversation);
  const tokens = expandTokens([...rawTokens, ...contextTokens], synonymMap);
  const normalisedQuestion = normalise(question);
  const entities = extractLikelyEntities(question, tokens);
  const userPermissions = new Set(context.userPermissions || []);
  const sourceFunctions = [
    ...(model.curatedKnowledge?.functions || []),
    ...(model.functions || []).filter((fn) => !String(fn.id || '').startsWith('function.curated.'))
  ];

  const matches = sourceFunctions
    .map((fn) => scoreFunction(fn, tokens, rawTokens, normalisedQuestion, intent, context, userPermissions))
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
  rawTokens: string[],
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
  const requestedActionFamilies = detectActionFamilies(rawTokens);
  const reasons: string[] = [];
  const meaningfulMatchedTokens = new Set<string>();
  let exactPhraseMatched = false;
  let score = 0;

  const exactPhrases = [fn.name, ...(fn.aliases || [])]
    .map((value) => normalise(String(value || '')))
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
  const questionTokens = new Set(tokenize(normalisedQuestion));
  for (const phrase of exactPhrases) {
    const phraseTokens = tokenize(phrase);
    const specificityBonus = Math.min(4, Math.max(0, phraseTokens.length - 2));
    if (normalisedQuestion.includes(phrase)) {
      score += (phrase === normalise(fn.name) ? 8 : 6) + specificityBonus;
      reasons.push(`phrase ${phrase}`);
      exactPhraseMatched = true;
      break;
    }
    if (phraseTokens.length > 1 && phraseTokens.every((token) => questionTokens.has(token))) {
      score += (phrase === normalise(fn.name) ? 7 : 5) + specificityBonus;
      reasons.push(`phrase tokens ${phrase}`);
      exactPhraseMatched = true;
      break;
    }
  }

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    if (haystackTokens.has(token)) {
      score += 4;
      reasons.push(`matched ${token}`);
      if (!LOW_SIGNAL_MATCH_TOKENS.has(token)) meaningfulMatchedTokens.add(token);
      continue;
    }
    if (token.length >= 5 && haystack.includes(token)) {
      score += 2;
      reasons.push(`partial ${token}`);
      if (!LOW_SIGNAL_MATCH_TOKENS.has(token)) meaningfulMatchedTokens.add(token);
      continue;
    }
    if (token.length >= 5 && hasNearToken(token, haystackTokens)) {
      score += 0.5;
      reasons.push(`near ${token}`);
    }
  }

  const intentHints = INTENT_HINTS[intent] || [];
  if (intentHints.some((hint) => haystack.includes(hint))) {
    score += 3;
    reasons.push(`intent ${intent}`);
  }

  for (const family of requestedActionFamilies) {
    const familyTerms = ACTION_FAMILIES.find((candidate) => candidate.name === family)?.terms || [];
    if (familyTerms.some((term) => haystackTokens.has(term) || haystack.includes(term))) {
      score += 8;
      reasons.push(`action ${family}`);
    } else {
      score -= 7;
      reasons.push(`missing action ${family}`);
    }
  }

  if (context.conversation?.lastFunctionId && fn.id === context.conversation.lastFunctionId && isPreviousFunctionReference(normalisedQuestion)) {
    score += 12;
    reasons.push('previous topic');
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
    score += 14;
    reasons.push('curated');
  } else if (/manual enrichment|requires manual|not evident/i.test(String(fn.auditStatus || fn.purpose || ''))) {
    score -= 8;
    reasons.push('thin generated record');
  }

  if (!exactPhraseMatched && meaningfulMatchedTokens.size === 0 && requestedActionFamilies.length === 0) {
    score = Math.min(score, 8);
    reasons.push('weak subject match');
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

function detectActionFamilies(tokens: string[]): string[] {
  const tokenSet = new Set(tokens);
  return ACTION_FAMILIES
    .filter((family) => family.terms.some((term) => tokenSet.has(term)))
    .map((family) => family.name);
}

function buildNextConversationState(
  best: NeoGuideMatch | undefined,
  intent: NeoGuideIntent,
  entities: string[],
  previous?: NeoGuideConversationState | null
): NeoGuideConversationState {
  if (!best) return previous || {};
  const topic = [
    best.function.name,
    ...(best.function.aliases || []).slice(0, 4),
  ].join(' ');
  return {
    topic,
    lastFunctionId: best.functionId,
    lastFunctionName: best.name,
    lastIntent: intent,
    lastEntities: entities.length > 0 ? entities : previous?.lastEntities || [],
  };
}

function getConversationContextTokens(question: string, conversation?: NeoGuideConversationState | null): string[] {
  if (!conversation?.topic) return [];
  const rawTokens = tokenize(question);
  const normalisedQuestion = normalise(question);
  if (!isReferentialFollowUp(normalisedQuestion)) return [];
  return tokenize(conversation.topic)
    .filter((token) => !['staff', 'trainee', 'course', 'dfp', 'neo'].includes(token))
    .slice(0, 6);
}

function isReferentialFollowUp(normalisedQuestion: string): boolean {
  if (/\b(that|this|it|he|she|his|her|they|them|same|also)\b/.test(normalisedQuestion)) return true;
  if (/^what about\b/.test(normalisedQuestion)) return true;
  return false;
}

function isPreviousFunctionReference(normalisedQuestion: string): boolean {
  return /\b(that|this|it|he|she|his|her|they|them|same)\b/.test(normalisedQuestion);
}

function buildAnswerText(
  intent: NeoGuideIntent,
  match: NeoGuideMatch,
  workflowOption?: NonNullable<NeoGuideFunction['workflowOptions']>[number]
): string {
  const fn = match.function;
  const locationPage = fn.location?.page || 'the relevant DFP-NEO page';
  const location = fn.location?.page ? ` Open ${fn.location.page}` : '';
  const purpose = fn.purpose || `${fn.name} is a DFP-NEO function.`;
  const dependency = first(fn.dependencies);
  const failure = first(fn.failureConditions);
  const rule = first(fn.businessRules);
  const steps = workflowOption
    ? formatWorkflowOptionSteps(workflowOption)
    : formatProcedureSteps(fn);
  const optionPrefix = workflowOption ? `${workflowOption.name}: ${workflowOption.summary || purpose}` : purpose;

  if (intent === 'WHY' || intent === 'TROUBLESHOOT') {
    const reasons = [failure, rule, dependency].filter(Boolean);
    return reasons.length > 0
      ? `${optionPrefix}${steps ? ` ${steps}` : ''} The most relevant checks are: ${reasons.join(' ')}`
      : `${optionPrefix}${steps ? ` ${steps}` : location ? ` ${location} to review it.` : ''}`;
  }

  if (intent === 'NAVIGATE' || intent === 'FIND') {
    return steps || `${fn.name} is in ${locationPage}.`;
  }

  if (intent === 'HOW_TO') {
    return `${optionPrefix}${steps ? ` ${steps}` : location ? ` Start from ${fn.location?.page}.` : ''}${rule ? ` ${rule}` : ''}`;
  }

  if (intent === 'PERMISSION') {
    const permissionText = match.permissions.length > 0 ? match.permissions.join(', ') : 'the relevant page permission';
    return `${fn.name} is controlled by ${permissionText}. If it is disabled, check the user role and permission profile for that function.`;
  }

  return `${optionPrefix}${steps ? ` ${steps}` : location ? ` ${location} for the relevant controls.` : ''}`;
}

function formatProcedureSteps(fn: NeoGuideFunction): string {
  if (Array.isArray(fn.procedureSteps) && fn.procedureSteps.length > 0) {
    return `Steps:\n${fn.procedureSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
  }
  if (fn.location?.page) return `Start from ${fn.location.page}.`;
  return '';
}

function formatWorkflowOptionSteps(option: NonNullable<NeoGuideFunction['workflowOptions']>[number]): string {
  if (Array.isArray(option.procedureSteps) && option.procedureSteps.length > 0) {
    return `Steps:\n${option.procedureSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
  }
  if (option.page) return `Start from ${option.page}.`;
  return '';
}

function hasWorkflowOptions(fn: NeoGuideFunction): boolean {
  return Array.isArray(fn.workflowOptions) && fn.workflowOptions.length > 1;
}

function selectWorkflowOption(
  fn: NeoGuideFunction,
  question: string
): NonNullable<NeoGuideFunction['workflowOptions']>[number] | undefined {
  if (!hasWorkflowOptions(fn)) return undefined;
  const normalisedQuestion = normalise(question);
  return fn.workflowOptions?.find((option) => {
    const optionTerms = [option.name, ...(option.aliases || [])].map((term) => normalise(term));
    return optionTerms.some((term) => term && normalisedQuestion.includes(term));
  });
}

function buildWorkflowChoiceText(fn: NeoGuideFunction): string {
  const options = fn.workflowOptions || [];
  const optionLines = options.map((option, index) => `${index + 1}. ${option.name}${option.summary ? ` - ${option.summary}` : ''}`);
  return `${fn.purpose || `${fn.name} can be done in more than one way.`}\n\nThere are multiple ways to do this:\n${optionLines.join('\n')}\n\nWhich method do you want to use?`;
}

function buildNavigationAction(
  match: NeoGuideMatch,
  workflowOption?: NonNullable<NeoGuideFunction['workflowOptions']>[number]
): NeoGuideNavigationAction | undefined {
  const location = match.location;
  const page = workflowOption?.page || location?.page || null;
  const anchor = workflowOption?.anchor || location?.anchor || null;
  if (!page && !location?.route && !anchor) return undefined;
  return {
    label: anchor ? `Open ${workflowOption?.name || match.name}` : `Open ${page || match.name}`,
    page,
    route: location?.route || null,
    anchor,
    highlightTarget: anchor
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

function buildSynonymMap(
  groups: NeoGuideSynonymGroup[],
  terminologyIndex: Array<{ term: string; normalised?: string; aliases?: string[]; count?: number }> = []
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    const canonical = normalise(group.canonical);
    tokenize(group.canonical).forEach((token) => map.set(token, canonical));
    for (const term of group.terms || []) {
      const termTokens = tokenize(term);
      if (termTokens.length === 1) map.set(termTokens[0], canonical);
    }
  }
  for (const entry of terminologyIndex) {
    const canonical = normalise(entry.normalised || entry.term);
    if (!canonical || (entry.count || 0) < 2) continue;
    const canonicalTokens = tokenize(canonical);
    if (canonicalTokens.length > 4) continue;
    canonicalTokens.forEach((token) => {
      if (token.length >= 3 && !map.has(token)) map.set(token, canonical);
    });
    (entry.aliases || []).forEach((alias) => {
      const aliasTokens = tokenize(alias);
      if (aliasTokens.length === 1 && aliasTokens[0].length >= 3 && !map.has(aliasTokens[0])) {
        map.set(aliasTokens[0], canonical);
      }
    });
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
