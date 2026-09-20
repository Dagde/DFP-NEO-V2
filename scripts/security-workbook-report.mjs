import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('..', import.meta.url).pathname);
const format = String(process.argv[2] || '--markdown').trim().toLowerCase();

const workbookParsePaths = [
  {
    file: 'components/BulkUpdateFlyout.tsx',
    parser: 'Browser staff bulk update importer',
    expectedValidation: 'validateSpreadsheetBeforeParse',
    controls: ['file size', 'extension', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links'],
  },
  {
    file: 'components/TraineeBulkUploadFlyout.tsx',
    parser: 'Browser trainee bulk upload importer',
    expectedValidation: 'validateSpreadsheetBeforeParse',
    controls: ['file size', 'extension', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links'],
  },
  {
    file: 'components/ScheduleView.tsx',
    parser: 'Browser schedule import',
    expectedValidation: 'validateSpreadsheetBeforeParse',
    controls: ['file size', 'extension', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links'],
  },
  {
    file: 'components/PlatformConfigurationSettings.tsx',
    parser: 'Browser platform configuration import',
    expectedValidation: 'validateSpreadsheetBeforeParse',
    controls: ['file size', 'extension', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links'],
  },
  {
    file: 'dfp-neo-platform/app/api/syllabus/bulk-upload/route.ts',
    parser: 'Server syllabus bulk upload route',
    expectedValidation: 'validateWorkbookUploadFile',
    controls: ['file size', 'extension', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links'],
  },
  {
    file: 'server.js',
    parser: 'Express syllabus bulk upload route',
    expectedValidation: 'validateSpreadsheetUploadFile',
    secondaryValidation: 'validateSpreadsheetThreatIndicators',
    shapeValidation: 'validateWorkbookShape',
    controls: ['multer upload limits', 'file size', 'extension', 'MIME type', 'XLSX/XLS signature', 'macro indicators', 'embedded objects', 'ActiveX', 'external workbook links', 'workbook shape'],
  },
];

function lineNumberFor(content, index) {
  return content.slice(0, index).split('\n').length;
}

function validatePath(entry) {
  const content = readFileSync(resolve(rootDir, entry.file), 'utf8');
  const parseIndex = content.indexOf('XLSX.read');
  const validationIndex = content.lastIndexOf(`${entry.expectedValidation}(`, parseIndex);
  const secondaryIndex = entry.secondaryValidation ? content.lastIndexOf(`${entry.secondaryValidation}(`, parseIndex) : -1;
  const shapeIndex = entry.shapeValidation && parseIndex >= 0 ? content.indexOf(`${entry.shapeValidation}(`, parseIndex) : -1;
  const hasParser = parseIndex >= 0;
  const hasPrimaryValidation = validationIndex >= 0 && validationIndex < parseIndex;
  const hasSecondaryValidation = !entry.secondaryValidation || (secondaryIndex >= 0 && secondaryIndex < parseIndex);
  const hasShapeValidation = !entry.shapeValidation || (shapeIndex >= 0 && shapeIndex > parseIndex);
  const status = hasParser && hasPrimaryValidation && hasSecondaryValidation && hasShapeValidation ? 'pass' : 'warn';
  return {
    ...entry,
    status,
    parseLine: hasParser ? lineNumberFor(content, parseIndex) : null,
    validationLine: validationIndex >= 0 ? lineNumberFor(content, validationIndex) : null,
    secondaryValidationLine: secondaryIndex >= 0 ? lineNumberFor(content, secondaryIndex) : null,
    shapeValidationLine: shapeIndex >= 0 ? lineNumberFor(content, shapeIndex) : null,
  };
}

function buildReport() {
  const paths = workbookParsePaths.map(validatePath);
  const pass = paths.filter((path) => path.status === 'pass').length;
  const warn = paths.length - pass;
  return {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 4 - Workbook Upload Risk Treatment',
    dependency: {
      package: 'xlsx',
      currentPosition: 'npm audit reports high advisories with no fixed upstream version available in the npm package.',
      treatment: 'Accepted interim risk with compensating controls and a planned replacement/sandboxing decision before high-assurance customer deployments.',
    },
    summary: {
      totalParsePaths: paths.length,
      pass,
      warn,
      overallStatus: warn === 0 ? 'pass' : 'warn',
    },
    paths,
    notes: [
      'This report records DFP NEO workbook-handling controls; it does not remove npm audit findings for the third-party xlsx package.',
      'Workbook uploads are rejected before parsing when size, type, signature or unsafe-content indicators fail validation.',
      'The xlsx package should still be replaced, sandboxed or reassessed when a viable maintained parser is selected.',
    ],
  };
}

function formatMarkdown(report) {
  const lines = [
    '# DFP NEO Workbook Upload Security Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Phase: ${report.phase}`,
    '',
    '## Summary',
    '',
    `- Workbook parse paths checked: ${report.summary.totalParsePaths}`,
    `- Pass: ${report.summary.pass}`,
    `- Warn: ${report.summary.warn}`,
    `- Overall status: ${report.summary.overallStatus}`,
    '',
    '## Dependency Position',
    '',
    `- Package: ${report.dependency.package}`,
    `- Current position: ${report.dependency.currentPosition}`,
    `- Treatment: ${report.dependency.treatment}`,
    '',
    '## Parse Paths',
    '',
    '| Status | Parser | File | Parse Line | Validation | Controls |',
    '| --- | --- | --- | ---: | --- | --- |',
  ];

  for (const path of report.paths) {
    const validation = [
      path.expectedValidation && `${path.expectedValidation}${path.validationLine ? `:${path.validationLine}` : ''}`,
      path.secondaryValidation && `${path.secondaryValidation}${path.secondaryValidationLine ? `:${path.secondaryValidationLine}` : ''}`,
      path.shapeValidation && `${path.shapeValidation}${path.shapeValidationLine ? `:${path.shapeValidationLine}` : ''}`,
    ].filter(Boolean).join(', ');
    lines.push(`| ${path.status} | ${path.parser} | ${path.file} | ${path.parseLine || ''} | ${validation} | ${path.controls.join(', ')} |`);
  }

  lines.push('', '## Evidence Notes', '');
  for (const note of report.notes) lines.push(`- ${note}`);
  return lines.join('\n');
}

const report = buildReport();

if (format === '--json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatMarkdown(report));
}

if (process.env.CI === 'true' && report.summary.warn > 0) {
  process.exitCode = 1;
}
