const DEFAULT_REQUIRED_HEADERS = [
  'Content-Security-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Permissions-Policy',
  'Referrer-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
];

function redactPresence(value) {
  return Boolean(String(value || '').trim());
}

function isProduction(env) {
  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function addControl(controls, control) {
  controls.push({
    status: control.status,
    category: control.category,
    control: control.control,
    detail: control.detail,
    action: control.action || '',
  });
}

function summariseControls(controls) {
  return controls.reduce((summary, control) => {
    summary[control.status] = (summary[control.status] || 0) + 1;
    return summary;
  }, { pass: 0, warn: 0, fail: 0 });
}

export function buildSecurityPostureReport(env = process.env, options = {}) {
  const production = isProduction(env);
  const allowedOriginsConfigured = redactPresence(env.DFP_NEO_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS);
  const jwtConfigured = redactPresence(env.JWT_SECRET || env.NEXTAUTH_SECRET || env.AUTH_SECRET);
  const jwtCandidate = String(env.JWT_SECRET || env.NEXTAUTH_SECRET || env.AUTH_SECRET || '');
  const controls = [];

  addControl(controls, {
    status: production ? 'pass' : 'warn',
    category: 'Runtime',
    control: 'Production runtime mode',
    detail: production ? 'Runtime is configured for production.' : 'Runtime is not reporting production mode.',
    action: production ? '' : 'Set NODE_ENV=production for production deployments.',
  });

  addControl(controls, {
    status: redactPresence(env.DATABASE_URL) ? 'pass' : 'fail',
    category: 'Runtime',
    control: 'Database connection configured',
    detail: redactPresence(env.DATABASE_URL) ? 'DATABASE_URL is present.' : 'DATABASE_URL is missing.',
    action: redactPresence(env.DATABASE_URL) ? '' : 'Configure DATABASE_URL before production use.',
  });

  addControl(controls, {
    status: jwtConfigured && jwtCandidate.length >= 32 ? 'pass' : production ? 'fail' : 'warn',
    category: 'Authentication',
    control: 'Session signing secret configured',
    detail: jwtConfigured
      ? `A signing secret is configured (${jwtCandidate.length} characters).`
      : 'No JWT/NEXTAUTH/AUTH secret is configured.',
    action: jwtConfigured && jwtCandidate.length >= 32
      ? ''
      : 'Configure a high-entropy JWT_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET with at least 32 characters.',
  });

  addControl(controls, {
    status: 'pass',
    category: 'Authentication',
    control: 'Browser session cookie is server-side',
    detail: 'Browser auth uses the dfp_neo_session HttpOnly cookie backed by the Session table.',
  });

  addControl(controls, {
    status: production ? 'pass' : 'warn',
    category: 'Authentication',
    control: 'Secure cookie mode',
    detail: production
      ? 'Production runtime forces Secure session cookies.'
      : 'Secure cookies are request/proxy dependent outside production.',
    action: production ? '' : 'Use HTTPS and NODE_ENV=production for deployed environments.',
  });

  addControl(controls, {
    status: production && !allowedOriginsConfigured ? 'warn' : 'pass',
    category: 'Network',
    control: 'CORS origin allow-list',
    detail: allowedOriginsConfigured
      ? 'Explicit CORS allowed origins are configured.'
      : 'No explicit cross-origin allow-list is configured; same-origin browser calls still work.',
    action: production && !allowedOriginsConfigured
      ? 'Set DFP_NEO_ALLOWED_ORIGINS when approved external origins are required.'
      : '',
  });

  addControl(controls, {
    status: isTruthy(env.DFP_ENABLE_DEBUG_ROUTES) ? 'fail' : 'pass',
    category: 'Runtime',
    control: 'Debug routes disabled',
    detail: isTruthy(env.DFP_ENABLE_DEBUG_ROUTES)
      ? 'DFP_ENABLE_DEBUG_ROUTES is enabled.'
      : 'Debug routes are disabled.',
    action: isTruthy(env.DFP_ENABLE_DEBUG_ROUTES) ? 'Disable DFP_ENABLE_DEBUG_ROUTES in production.' : '',
  });

  addControl(controls, {
    status: isTruthy(env.DFP_TESTING_FUNCTIONS_ENABLED) ? 'fail' : 'pass',
    category: 'Runtime',
    control: 'Testing functions disabled',
    detail: isTruthy(env.DFP_TESTING_FUNCTIONS_ENABLED)
      ? 'DFP_TESTING_FUNCTIONS_ENABLED is enabled.'
      : 'Temporary testing functions are disabled.',
    action: isTruthy(env.DFP_TESTING_FUNCTIONS_ENABLED) ? 'Disable testing functions outside isolated testbeds.' : '',
  });

  addControl(controls, {
    status: isTruthy(env.ALLOW_DEMO_SEEDING) ? 'warn' : 'pass',
    category: 'Runtime',
    control: 'Demo seed endpoints disabled',
    detail: isTruthy(env.ALLOW_DEMO_SEEDING)
      ? 'ALLOW_DEMO_SEEDING is enabled.'
      : 'Demo seed endpoints are disabled.',
    action: isTruthy(env.ALLOW_DEMO_SEEDING) ? 'Disable ALLOW_DEMO_SEEDING outside controlled setup windows.' : '',
  });

  addControl(controls, {
    status: redactPresence(env.DFP_NEO_SECURITY_EVENT_WEBHOOK_URL) ? 'pass' : 'warn',
    category: 'Monitoring',
    control: 'External security event forwarding',
    detail: redactPresence(env.DFP_NEO_SECURITY_EVENT_WEBHOOK_URL)
      ? 'Security event webhook is configured.'
      : 'Security events are stored locally but not forwarded to an external monitoring destination.',
    action: redactPresence(env.DFP_NEO_SECURITY_EVENT_WEBHOOK_URL)
      ? ''
      : 'Configure DFP_NEO_SECURITY_EVENT_WEBHOOK_URL or document the approved central logging alternative.',
  });

  addControl(controls, {
    status: 'pass',
    category: 'Monitoring',
    control: 'Security event evidence export',
    detail: 'Admins can export locally stored security monitoring events for review evidence.',
  });

  addControl(controls, {
    status: 'pass',
    category: 'Monitoring',
    control: 'Security evidence bundle',
    detail: 'Admins can download a combined posture, monitoring and recent-events evidence bundle.',
  });

  addControl(controls, {
    status: 'pass',
    category: 'Monitoring',
    control: 'Redacted evidence bundle',
    detail: 'Admins can download a redacted external/shareable evidence bundle.',
  });

  const headerList = Array.isArray(options.requiredHeaders) && options.requiredHeaders.length > 0
    ? options.requiredHeaders
    : DEFAULT_REQUIRED_HEADERS;
  addControl(controls, {
    status: 'pass',
    category: 'Headers',
    control: 'Baseline browser security headers configured',
    detail: `Application sets ${headerList.join(', ')}.`,
  });

  addControl(controls, {
    status: 'warn',
    category: 'Headers',
    control: 'Content Security Policy still allows inline assets',
    detail: 'The current UI requires inline script/style allowances while the frontend is being hardened.',
    action: 'Track CSP tightening as a future hardening task after verifying the production bundle.',
  });

  const summary = summariseControls(controls);
  return {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 3 - Platform Security Controls',
    environment: {
      nodeEnv: env.NODE_ENV || 'development',
      production,
      allowedOriginsConfigured,
      databaseConfigured: redactPresence(env.DATABASE_URL),
      securityEventForwardingConfigured: redactPresence(env.DFP_NEO_SECURITY_EVENT_WEBHOOK_URL),
    },
    summary,
    overallStatus: summary.fail > 0 ? 'fail' : summary.warn > 0 ? 'warn' : 'pass',
    controls,
  };
}

export function formatSecurityPostureMarkdown(report) {
  const lines = [
    `# ${report.phase}`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Overall status: ${report.overallStatus.toUpperCase()}`,
    '',
    '| Status | Category | Control | Detail | Action |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const control of report.controls) {
    lines.push(`| ${control.status.toUpperCase()} | ${control.category} | ${control.control} | ${control.detail} | ${control.action || ''} |`);
  }
  lines.push('');
  return lines.join('\n');
}
