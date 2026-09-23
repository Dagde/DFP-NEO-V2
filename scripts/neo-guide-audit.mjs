import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();

const sourceRoots = [
  'App.tsx',
  'components',
  'utils',
  'dfp-neo-platform/app',
  'prisma/schema.prisma',
  'server.js',
  'mobile-endpoints.js',
  'tie-engine.cjs',
].map((entry) => path.join(repoRoot, entry));

const excludedPathFragments = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}.browser_data${path.sep}`,
  `${path.sep}DFP-NEO-V2${path.sep}`,
  `${path.sep}DFP-NEO-Hybrid-V3${path.sep}`,
  `${path.sep}DFP-NEO-Website${path.sep}`,
  `${path.sep}dfp-neo-platform${path.sep}public${path.sep}`,
  `${path.sep}public${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}.next${path.sep}`,
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.prisma']);
const enrichmentPath = path.join(repoRoot, 'data', 'neo-guide', 'dfp-neo-guide-enrichment.json');
const jsxControlTags = new Set(['button', 'input', 'select', 'textarea', 'option', 'label', 'a']);
const interestingAttributes = new Set([
  'id',
  'name',
  'type',
  'title',
  'aria-label',
  'placeholder',
  'value',
  'checked',
  'disabled',
  'onClick',
  'onChange',
  'onSubmit',
  'onBlur',
  'onFocus',
  'href',
  'data-neo-guide',
  'data-guide',
]);

const permissionLikePattern = /\b[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*){1,4}\b/g;
const userVisibleSignalPattern = /(warning|error|denied|cannot|can't|unavailable|conflict|invalid|required|locked|not allowed|failed|fail|missing|disabled|permission)/i;

const toPosix = (value) => value.split(path.sep).join('/');
const relativePath = (filePath) => toPosix(path.relative(repoRoot, filePath));
const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const slug = (value) => String(value || '')
  .toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 96) || 'unnamed';

const normaliseText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse ${relativePath(filePath)}: ${error.message}`);
  }
}

const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

function walk(entryPath, files = []) {
  if (!fs.existsSync(entryPath)) return files;
  if (excludedPathFragments.some((fragment) => entryPath.includes(fragment))) return files;
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, child), files);
    }
    return files;
  }
  if (sourceExtensions.has(path.extname(entryPath))) files.push(entryPath);
  return files;
}

const sourceFiles = Array.from(new Set(sourceRoots.flatMap((root) => walk(root))))
  .filter((filePath) => fs.existsSync(filePath))
  .sort((left, right) => relativePath(left).localeCompare(relativePath(right)));

function getAttributeMap(attributes) {
  const result = {};
  for (const attr of attributes.properties || []) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.getText();
    if (!interestingAttributes.has(name)) continue;
    if (!attr.initializer) {
      result[name] = true;
      continue;
    }
    if (ts.isStringLiteral(attr.initializer)) {
      result[name] = attr.initializer.text;
      continue;
    }
    if (ts.isJsxExpression(attr.initializer)) {
      result[name] = normaliseText(attr.initializer.expression?.getText() || '');
      continue;
    }
    result[name] = normaliseText(attr.initializer.getText());
  }
  return result;
}

function jsxChildrenText(node) {
  if (!node.children) return '';
  const parts = [];
  for (const child of node.children) {
    if (ts.isJsxText(child)) {
      parts.push(child.getText());
    } else if (ts.isJsxExpression(child) && child.expression) {
      const exprText = child.expression.getText();
      if (/^[A-Za-z0-9_.$\s?:'"`+\-()]+$/.test(exprText)) parts.push(exprText);
    } else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
      parts.push(jsxChildrenText(child));
    }
  }
  return normaliseText(parts.join(' '));
}

function stringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `\${${span.expression.getText()}}${span.literal.text}`).join('');
  }
  return '';
}

function collectSourceAudit(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = relativePath(filePath);
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    return {
      file: rel,
      components: [],
      controls: [],
      guideTargets: [],
      permissions: collectPermissionsFromText(content, rel),
      userVisibleMessages: collectMessagesFromText(content, rel),
    };
  }

  const sourceKind = ['.tsx', '.jsx'].includes(ext) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true, sourceKind);
  const components = [];
  const controls = [];
  const guideTargets = [];
  const permissions = collectPermissionsFromText(content, rel);
  const messages = collectMessagesFromText(content, rel);

  const pushComponent = (name, node, kind) => {
    if (!/^[A-Z]/.test(name)) return;
    components.push({
      id: `component.${slug(name)}`,
      name,
      kind,
      file: rel,
      line: lineOf(sourceFile, node),
    });
  };

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      pushComponent(node.name.text, node, 'function');
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        pushComponent(node.name.text, node, 'variable-function');
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = opening.tagName.getText();
      const attributes = getAttributeMap(opening.attributes);
      if (attributes['data-neo-guide']) {
        guideTargets.push({
          id: String(attributes['data-neo-guide']),
          tagName,
          file: rel,
          line: lineOf(sourceFile, node),
        });
      }
      if (jsxControlTags.has(tagName)) {
        const text = ts.isJsxElement(node) ? jsxChildrenText(node) : '';
        const label = normaliseText(
          attributes['aria-label'] ||
          attributes.title ||
          attributes.placeholder ||
          text ||
          attributes.name ||
          attributes.id ||
          tagName
        );
        controls.push({
          id: `control.${slug(rel)}.${slug(label)}.${lineOf(sourceFile, node)}`,
          label,
          tagName,
          attributes,
          file: rel,
          line: lineOf(sourceFile, node),
          guideTarget: attributes['data-neo-guide'] || null,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { file: rel, components, controls, guideTargets, permissions, userVisibleMessages: messages };
}

function collectPermissionsFromText(content, rel) {
  const permissions = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = line.match(permissionLikePattern) || [];
    for (const match of matches) {
      if (!/^(dfp|staff|trainee|settings|neo|courseProgress|trainingRecords|trainingReport|sct|lmp|admin|mobile|audit|aircraft|schedule|user)\./.test(match)) continue;
      permissions.push({
        id: match,
        file: rel,
        line: index + 1,
        context: normaliseText(line).slice(0, 240),
      });
    }
  });
  return permissions;
}

function collectMessagesFromText(content, rel) {
  const messages = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!userVisibleSignalPattern.test(line)) return;
    const stringMatches = [...line.matchAll(/(['"`])((?:(?!\1).){8,240})\1/g)];
    for (const match of stringMatches) {
      const text = normaliseText(match[2]);
      if (!userVisibleSignalPattern.test(text)) continue;
      messages.push({
        id: `message.${slug(rel)}.${slug(text)}.${index + 1}`,
        text,
        file: rel,
        line: index + 1,
      });
    }
  });
  return messages;
}

function parsePrismaSchema(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  const modelPattern = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  for (const match of content.matchAll(modelPattern)) {
    const name = match[1];
    const body = match[2];
    const fields = body.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('@@') && !line.startsWith('//'))
      .map((line) => {
        const [fieldName, fieldType, ...rest] = line.split(/\s+/);
        return {
          name: fieldName,
          type: fieldType || '',
          attributes: rest.join(' '),
          isRelation: /\@relation/.test(line) || /^[A-Z]/.test(fieldType || ''),
          isJson: fieldType === 'Json' || fieldType === 'Json?',
          isOptional: /\?$/.test(fieldType || ''),
          isList: /\[\]$/.test(fieldType || ''),
        };
      });
    models.push({
      id: `data-model.${slug(name)}`,
      name,
      fields,
      relationships: fields.filter((field) => field.isRelation).map((field) => ({
        field: field.name,
        target: field.type.replace(/[?\[\]]/g, ''),
      })),
    });
  }
  return models;
}

function routePathFromFile(rel) {
  let route = rel
    .replace(/^dfp-neo-platform\/app/, '')
    .replace(/\/route\.(ts|tsx|js|jsx)$/, '')
    .replace(/\/page\.(ts|tsx|js|jsx)$/, '')
    .replace(/\/layout\.(ts|tsx|js|jsx)$/, '')
    .replace(/\(([^)]+)\)\//g, '')
    .replace(/\[([^\]]+)\]/g, ':$1');
  if (!route || route === '/') return '/';
  return route.replace(/\/+/g, '/');
}

function collectRoutes(files) {
  return files
    .map((filePath) => relativePath(filePath))
    .filter((rel) => rel.startsWith('dfp-neo-platform/app/') && /\/(page|route)\.(ts|tsx|js|jsx)$/.test(rel))
    .map((rel) => {
      const kind = rel.endsWith('/route.ts') || rel.endsWith('/route.js') ? 'api-route' : 'page';
      const content = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      const methods = kind === 'api-route'
        ? Array.from(content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)).map((match) => match[1])
        : [];
      return {
        id: `${kind}.${slug(routePathFromFile(rel))}`,
        kind,
        route: routePathFromFile(rel),
        file: rel,
        methods,
      };
    });
}

function collectExpressEndpoints() {
  const endpoints = [];
  for (const file of ['server.js', 'mobile-endpoints.js']) {
    const filePath = path.join(repoRoot, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/i);
      if (!match) return;
      endpoints.push({
        id: `express.${match[1].toUpperCase()}.${slug(match[3])}`,
        method: match[1].toUpperCase(),
        route: match[3],
        file,
        line: index + 1,
      });
    });
  }
  return endpoints;
}

function buildFunctionIndex(audits, routes, prismaModels) {
  const routeFunctions = routes.map((route) => ({
    id: `function.${slug(route.kind)}.${slug(route.route)}`,
    name: route.route === '/' ? 'Application home' : route.route,
    aliases: [route.route, route.file],
    location: {
      page: route.kind === 'page' ? route.route : null,
      route: route.route,
      component: route.file,
      anchor: null,
    },
    purpose: route.kind === 'api-route'
      ? `Server endpoint exposed by ${route.file}.`
      : `Application page rendered by ${route.file}.`,
    inputs: [],
    outputs: [],
    permissions: [],
    dependencies: [],
    businessRules: [],
    failureConditions: [],
    relatedFunctions: [],
    auditStatus: 'IMPLEMENTED - extracted from current route files',
  }));

  const controlsByComponent = audits.flatMap((audit) => audit.controls).map((control) => ({
    id: `function.${slug(control.id)}`,
    name: control.label,
    aliases: Array.from(new Set([control.label, control.attributes?.title, control.attributes?.placeholder, control.attributes?.name].filter(Boolean))),
    location: {
      page: inferPageFromFile(control.file),
      route: null,
      component: control.file,
      anchor: control.guideTarget,
      line: control.line,
    },
    purpose: `${control.tagName} control in ${control.file}. Purpose requires manual enrichment where not evident from implementation.`,
    inputs: control.tagName === 'input' || control.tagName === 'select' || control.tagName === 'textarea'
      ? [{
          fieldName: control.attributes?.name || control.attributes?.id || control.label,
          fieldType: control.attributes?.type || control.tagName,
          permittedValues: [],
          defaultValue: control.attributes?.value || null,
          required: false,
          validation: [],
          dependencies: control.attributes?.disabled ? [`disabled when ${control.attributes.disabled}`] : [],
          sourceOfData: 'current component implementation',
        }]
      : [],
    outputs: control.attributes?.onClick || control.attributes?.onChange
      ? [`handler: ${control.attributes.onClick || control.attributes.onChange}`]
      : [],
    permissions: audits.find((audit) => audit.file === control.file)?.permissions.map((permission) => permission.id) || [],
    dependencies: control.attributes?.disabled ? [`Disabled expression: ${control.attributes.disabled}`] : [],
    businessRules: [],
    failureConditions: [],
    relatedFunctions: [],
    auditStatus: 'IMPLEMENTED - extracted from JSX control',
  }));

  const dataFunctions = prismaModels.map((model) => ({
    id: `function.data.${slug(model.name)}`,
    name: `${model.name} data model`,
    aliases: [model.name, ...model.fields.map((field) => field.name)],
    location: {
      page: null,
      route: null,
      component: 'prisma/schema.prisma',
      anchor: model.id,
    },
    purpose: `Database model ${model.name} with ${model.fields.length} fields.`,
    inputs: model.fields.map((field) => ({
      fieldName: field.name,
      fieldType: field.type,
      permittedValues: [],
      defaultValue: null,
      required: !field.isOptional,
      validation: field.attributes ? [field.attributes] : [],
      dependencies: field.isRelation ? [`relationship target ${field.type.replace(/[?[\]]/g, '')}`] : [],
      sourceOfData: 'Prisma schema',
    })),
    outputs: [],
    permissions: [],
    dependencies: model.relationships.map((rel) => `${rel.field} -> ${rel.target}`),
    businessRules: [],
    failureConditions: [],
    relatedFunctions: model.relationships.map((rel) => `function.data.${slug(rel.target)}`),
    auditStatus: 'IMPLEMENTED - extracted from Prisma schema',
  }));

  return [...routeFunctions, ...controlsByComponent, ...dataFunctions];
}

function inferPageFromFile(file) {
  const base = path.basename(file).replace(/\.(tsx|ts|jsx|js)$/, '');
  if (base === 'App') return 'Application shell';
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function buildConceptGraph(prismaModels, functions, curatedConcepts = []) {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, label, kind, source) => nodes.set(id, { id, label, kind, source });
  prismaModels.forEach((model) => {
    const modelId = `concept.${slug(model.name)}`;
    addNode(modelId, model.name, 'data-model', 'Prisma schema');
    model.relationships.forEach((relationship) => {
      const targetId = `concept.${slug(relationship.target)}`;
      addNode(targetId, relationship.target, 'data-model', 'Prisma schema');
      edges.push({
        from: modelId,
        to: targetId,
        relationship: relationship.field,
        source: 'Prisma schema relation',
      });
    });
  });

  const conceptKeywords = [
    ['trainee', 'Trainee'],
    ['instructor', 'Instructor'],
    ['staff', 'Staff'],
    ['course', 'Course'],
    ['schedule', 'Schedule'],
    ['aircraft', 'Aircraft'],
    ['availability', 'Availability'],
    ['unavailability', 'Unavailability'],
    ['priority', 'Priority'],
    ['permission', 'Permission'],
    ['training report', 'Training Report'],
    ['neo build', 'NEO Build'],
    ['lmp', 'LMP'],
    ['currency', 'Currency'],
    ['qualification', 'Qualification'],
    ['cancellation', 'Cancellation'],
  ];

  functions.slice(0, 2000).forEach((fn) => {
    const text = `${fn.name} ${fn.aliases?.join(' ') || ''} ${fn.purpose}`.toLowerCase();
    for (const [keyword, label] of conceptKeywords) {
      if (!text.includes(keyword)) continue;
      const conceptId = `concept.${slug(label)}`;
      addNode(conceptId, label, 'application-concept', 'derived from function names and code text');
      edges.push({
        from: conceptId,
        to: fn.id,
        relationship: 'implemented-by',
        source: 'derived from audited function index',
      });
    }
  });

  curatedConcepts.forEach((concept) => {
    const conceptId = concept.id || `concept.${slug(concept.name || concept.label)}`;
    addNode(conceptId, concept.name || concept.label || conceptId, concept.kind || 'curated-application-concept', 'curated NEO Guide enrichment');
    (concept.relationships || []).forEach((relationship) => {
      const targetId = relationship.target || relationship.to;
      if (!targetId) return;
      edges.push({
        from: conceptId,
        to: targetId,
        relationship: relationship.type || relationship.relationship || 'related-to',
        source: 'curated NEO Guide enrichment',
      });
    });
  });

  return {
    nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges,
  };
}

const sourceAudits = sourceFiles.map(collectSourceAudit);
const prismaModels = parsePrismaSchema(path.join(repoRoot, 'prisma/schema.prisma'));
const routes = collectRoutes(sourceFiles);
const expressEndpoints = collectExpressEndpoints();
const sourceDerivedFunctions = buildFunctionIndex(sourceAudits, [...routes, ...expressEndpoints.map((endpoint) => ({
  id: endpoint.id,
  kind: 'express-endpoint',
  route: endpoint.route,
  file: endpoint.file,
  methods: [endpoint.method],
}))], prismaModels);
const curatedKnowledge = readJsonFile(enrichmentPath, {
  schemaVersion: 'neo-guide-enrichment.v1',
  functions: [],
  concepts: [],
  synonyms: [],
});
const curatedFunctions = (curatedKnowledge.functions || []).map((fn) => ({
  ...fn,
  id: fn.id || `function.curated.${slug(fn.name)}`,
  aliases: Array.isArray(fn.aliases) ? fn.aliases : [],
  inputs: Array.isArray(fn.inputs) ? fn.inputs : [],
  outputs: Array.isArray(fn.outputs) ? fn.outputs : [],
  permissions: Array.isArray(fn.permissions) ? fn.permissions : [],
  dependencies: Array.isArray(fn.dependencies) ? fn.dependencies : [],
  businessRules: Array.isArray(fn.businessRules) ? fn.businessRules : [],
  failureConditions: Array.isArray(fn.failureConditions) ? fn.failureConditions : [],
  relatedFunctions: Array.isArray(fn.relatedFunctions) ? fn.relatedFunctions : [],
  auditStatus: fn.auditStatus || 'IMPLEMENTED - manually enriched from current implementation review',
}));
const functions = [...curatedFunctions, ...sourceDerivedFunctions];
const conceptGraph = buildConceptGraph(prismaModels, functions, curatedKnowledge.concepts || []);

const permissionIds = Array.from(new Map(
  sourceAudits.flatMap((audit) => audit.permissions).map((permission) => [permission.id, permission])
).values()).sort((a, b) => a.id.localeCompare(b.id));

const messages = sourceAudits.flatMap((audit) => audit.userVisibleMessages);
const controls = sourceAudits.flatMap((audit) => audit.controls);
const components = sourceAudits.flatMap((audit) => audit.components);
const guideTargets = sourceAudits.flatMap((audit) => audit.guideTargets);

const knowledgeModel = {
  schemaVersion: 'neo-guide-knowledge-model.v1',
  generatedAt,
  source: {
    repository: path.basename(repoRoot),
    sourceFileCount: sourceFiles.length,
    excludedPathFragments: excludedPathFragments.map((fragment) => fragment.split(path.sep).join('/')),
    generationMethod: 'Static audit of current DFP-NEO source code. This is not a manually invented FAQ.',
  },
  auditStatus: {
    phase: 'NEO Guide Phase 2 - source-derived model with curated implementation enrichment',
    complete: false,
    limitations: [
      'This combines machine extraction with a first curated enrichment pass; it is not yet the final guide corpus.',
      'Control purpose is extracted from code location, labels and handlers unless a curated function has been added.',
      'Live-data reasoning and permission-enforced guide API are not enabled in this phase.',
    ],
  },
  applicationSurface: {
    components,
    controls,
    guideTargets,
    routes,
    expressEndpoints,
  },
  dataArchitecture: {
    prismaModels,
  },
  permissions: {
    ids: permissionIds,
  },
  warningsAndErrors: {
    messages,
  },
  functions,
  curatedKnowledge: {
    schemaVersion: curatedKnowledge.schemaVersion || 'neo-guide-enrichment.v1',
    updatedAt: curatedKnowledge.updatedAt || null,
    functionCount: curatedFunctions.length,
    conceptCount: (curatedKnowledge.concepts || []).length,
    synonymCount: (curatedKnowledge.synonyms || []).length,
    functions: curatedFunctions,
    concepts: curatedKnowledge.concepts || [],
    synonyms: curatedKnowledge.synonyms || [],
  },
  conceptGraph,
  guideEngineRequirements: {
    prohibitedTerms: ['AI', 'Artificial Intelligence', 'ChatGPT', 'AI assistant'],
    localOnly: true,
    readOnlyByDefault: true,
    requiresPermissionAwareServerDataAccess: true,
    supportsNavigationTargets: true,
  },
};

const compactKnowledgeModel = {
  schemaVersion: 'neo-guide-runtime-model.v1',
  generatedAt,
  source: knowledgeModel.source,
  auditStatus: knowledgeModel.auditStatus,
  routes,
  expressEndpoints,
  dataModels: prismaModels.map((model) => ({
    id: model.id,
    name: model.name,
    fields: model.fields.map((field) => ({
      name: field.name,
      type: field.type,
      required: !field.isOptional,
      isJson: field.isJson,
      isRelation: field.isRelation,
    })),
    relationships: model.relationships,
  })),
  permissions: {
    ids: permissionIds.map((permission) => permission.id),
  },
  curatedKnowledge: {
    schemaVersion: curatedKnowledge.schemaVersion || 'neo-guide-enrichment.v1',
    updatedAt: curatedKnowledge.updatedAt || null,
    functionCount: curatedFunctions.length,
    conceptCount: (curatedKnowledge.concepts || []).length,
    synonymCount: (curatedKnowledge.synonyms || []).length,
    functions: curatedFunctions,
    concepts: curatedKnowledge.concepts || [],
    synonyms: curatedKnowledge.synonyms || [],
  },
  guideTargets,
  functions: functions.map((fn) => ({
    id: fn.id,
    name: fn.name,
    aliases: fn.aliases,
    location: fn.location,
    purpose: fn.purpose,
    inputs: fn.inputs,
    outputs: fn.outputs,
    permissions: Array.from(new Set(fn.permissions || [])),
    dependencies: fn.dependencies,
    failureConditions: fn.failureConditions,
    relatedFunctions: fn.relatedFunctions,
    auditStatus: fn.auditStatus,
  })),
  warningsAndErrors: {
    messages: messages.map((message) => ({
      id: message.id,
      text: message.text,
      file: message.file,
      line: message.line,
    })),
  },
  conceptGraph,
  guideEngineRequirements: knowledgeModel.guideEngineRequirements,
};

const outputDir = path.join(repoRoot, 'public', 'neo-guide');
const platformOutputDir = path.join(repoRoot, 'dfp-neo-platform', 'public', 'flight-school-app', 'neo-guide');
ensureDir(outputDir);
ensureDir(platformOutputDir);
const outputJson = JSON.stringify(compactKnowledgeModel, null, 2);
fs.writeFileSync(path.join(outputDir, 'dfp-neo-knowledge-model.json'), outputJson);
fs.writeFileSync(path.join(platformOutputDir, 'dfp-neo-knowledge-model.json'), outputJson);

const docsDir = path.join(repoRoot, 'docs', 'neo-guide');
ensureDir(docsDir);
fs.writeFileSync(path.join(docsDir, 'dfp-neo-knowledge-model.full.json'), JSON.stringify(knowledgeModel, null, 2));
const summary = `# NEO Guide Source Audit

Generated: ${generatedAt}

## Status

This is the Phase 2 source-derived knowledge model foundation for NEO Guide, with a first curated implementation-enrichment layer. It is generated from the current DFP-NEO implementation and is intentionally not a generic FAQ.

## Counts

- Source files inspected: ${sourceFiles.length}
- Components found: ${components.length}
- Controls found: ${controls.length}
- Stable guide targets already present: ${guideTargets.length}
- Page/API routes found: ${routes.length}
- Express endpoints found: ${expressEndpoints.length}
- Prisma models found: ${prismaModels.length}
- Permission references found: ${permissionIds.length}
- Warning/error/status messages found: ${messages.length}
- Curated workflow functions: ${curatedFunctions.length}
- Curated concept records: ${(curatedKnowledge.concepts || []).length}
- Curated synonym groups: ${(curatedKnowledge.synonyms || []).length}
- Function records generated: ${functions.length}
- Concept graph nodes: ${conceptGraph.nodes.length}
- Concept graph edges: ${conceptGraph.edges.length}

## Outputs

- \`public/neo-guide/dfp-neo-knowledge-model.json\`
- \`dfp-neo-platform/public/flight-school-app/neo-guide/dfp-neo-knowledge-model.json\`
- \`docs/neo-guide/dfp-neo-knowledge-model.full.json\`

## Next Required Work

1. Continue enriching extracted functions with verified workflow summaries from implementation review.
2. Expand stable \`data-neo-guide\` target coverage beyond the main navigation and operational controls.
3. Build the local interpretation/reasoning engine over this model.
4. Add a permission-aware read-only guide API for live-data troubleshooting.
5. Add the NEO Guide UI and navigation/highlight behavior.
`;
fs.writeFileSync(path.join(docsDir, 'source-audit-summary.md'), summary);

console.log(`# NEO Guide Source Audit`);
console.log(`Generated: ${generatedAt}`);
console.log(`Source files inspected: ${sourceFiles.length}`);
console.log(`Components: ${components.length}`);
console.log(`Controls: ${controls.length}`);
console.log(`Routes: ${routes.length}`);
console.log(`Express endpoints: ${expressEndpoints.length}`);
console.log(`Prisma models: ${prismaModels.length}`);
console.log(`Permissions: ${permissionIds.length}`);
console.log(`Messages: ${messages.length}`);
console.log(`Curated workflow functions: ${curatedFunctions.length}`);
console.log(`Functions: ${functions.length}`);
console.log(`Concept graph: ${conceptGraph.nodes.length} nodes, ${conceptGraph.edges.length} edges`);
console.log(`Wrote public/neo-guide/dfp-neo-knowledge-model.json`);
