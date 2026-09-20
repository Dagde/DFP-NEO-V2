import { buildSecurityPostureReport, formatSecurityPostureMarkdown } from '../utils/securityPosture.js';

const report = buildSecurityPostureReport(process.env);
const format = String(process.argv[2] || '--markdown').trim().toLowerCase();

if (format === '--json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatSecurityPostureMarkdown(report));
}

if (report.summary.fail > 0 && process.env.CI === 'true') {
  process.exitCode = 1;
}
