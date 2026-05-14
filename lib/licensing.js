import crypto from 'crypto';

export const LICENSE_FILE_SCHEMA = 'dfp-neo-license/v1';
export const LICENSE_PAYLOAD_SCHEMA = 'dfp-neo-license-payload/v1';
export const LICENSE_ALGORITHM = 'Ed25519';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value).slice(0, 10));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const toIsoDate = (value) => {
  const date = toDateOnly(value);
  return date ? date.toISOString().slice(0, 10) : null;
};

const normaliseStatus = (value) => String(value || 'ACTIVE').trim().toUpperCase();

export const normaliseLicenceEnforcementMode = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'monitor' || raw === 'monitor only') return 'Monitor Only';
  if (raw === 'warn' || raw === 'warn only') return 'Warn Only';
  if (raw === 'block' || raw === 'block expired' || raw === 'block expired licence') return 'Block Expired Licence';
  return 'Monitor Only';
};

export const normaliseLicenseRuntimeMode = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (['production', 'prod', 'live', 'customer'].includes(raw)) return 'production';
  if (['staging', 'stage', 'uat', 'acceptance'].includes(raw)) return 'staging';
  return 'development';
};

export const getLicenseRuntimeMode = (env = process.env) => normaliseLicenseRuntimeMode(
  env.DFP_LICENSE_MODE ||
  env.DFP_LICENCE_MODE ||
  env.DFP_LICENSE_RUNTIME ||
  env.DFP_LICENCE_RUNTIME ||
  'development',
);

export const canonicalStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
};

export const base64urlEncode = (value) => Buffer
  .from(value)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

export const base64urlDecode = (value) => {
  const normalised = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalised.length % 4)) % 4);
  return Buffer.from(`${normalised}${padding}`, 'base64');
};

const parseJsonMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalisePem = (value) => String(value || '').replace(/\\n/g, '\n').trim();

export const parsePublicKeysFromEnv = (env = process.env) => {
  const keys = [];
  const json = parseJsonMaybe(env.DFP_LICENSE_PUBLIC_KEYS_JSON || env.DFP_LICENCE_PUBLIC_KEYS_JSON);
  if (Array.isArray(json)) {
    json.forEach((entry, index) => {
      const publicKeyPem = normalisePem(entry?.publicKeyPem || entry?.publicKey || entry?.pem);
      if (publicKeyPem) keys.push({ keyId: entry?.keyId || `key-${index + 1}`, publicKeyPem });
    });
  }

  const singleKey = normalisePem(env.DFP_LICENSE_PUBLIC_KEY || env.DFP_LICENCE_PUBLIC_KEY);
  if (singleKey) {
    keys.push({
      keyId: env.DFP_LICENSE_KEY_ID || env.DFP_LICENCE_KEY_ID || 'primary',
      publicKeyPem: singleKey,
    });
  }

  return keys;
};

export const getDeploymentFingerprint = (context = {}, env = process.env) => {
  const organisationCode = context.organisationCode || context.organisation?.code || env.DFP_ORGANISATION_CODE || 'UNKNOWN';
  const deploymentIdentifier = (
    context.deploymentIdentifier ||
    context.deploymentProfile?.deploymentIdentifier ||
    context.operationalRunbook?.deploymentIdentifier ||
    env.DFP_DEPLOYMENT_IDENTIFIER ||
    'DFP-NEO'
  );
  const installationId = (
    env.DFP_INSTALLATION_ID ||
    env.DFP_DEPLOYMENT_ID ||
    env.RAILWAY_SERVICE_ID ||
    env.RAILWAY_PROJECT_ID ||
    'development-installation'
  );
  const hash = crypto
    .createHash('sha256')
    .update(`dfp-neo|${organisationCode}|${deploymentIdentifier}|${installationId}`)
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
  return `DFP-${hash}`;
};

const publicContext = (context = {}) => ({
  application: context.packageMetadata?.name || context.applicationName || 'daily-flying-program',
  version: context.packageMetadata?.version || context.applicationVersion || 'unknown',
  deploymentFingerprint: context.deploymentFingerprint || getDeploymentFingerprint(context),
});

export const buildLicensePayloadFromRecord = (license = {}, context = {}) => {
  const features = { ...(license.features || {}) };
  delete features.signedLicenseFile;
  delete features.signatureStatus;
  delete features.signatureDetail;
  delete features.importedSignedLicense;

  return {
    schema: LICENSE_PAYLOAD_SCHEMA,
    issuedAt: new Date().toISOString(),
    application: publicContext(context),
    customer: {
      organisationCode: license.organisationCode || context.organisationCode || context.organisation?.code || 'UNKNOWN',
      organisationName: context.organisationName || context.organisation?.name || license.organisationCode || 'UNKNOWN',
    },
    license: {
      licenseKey: license.licenseKey || '',
      licenseName: license.licenseName || '',
      deploymentMode: license.deploymentMode || 'Online SaaS',
      status: normaliseStatus(license.status),
      validFrom: toIsoDate(license.validFrom),
      validUntil: toIsoDate(license.validUntil),
      maxUsers: license.maxUsers ?? null,
      maxUnits: license.maxUnits ?? null,
      maxAircraftTypes: license.maxAircraftTypes ?? null,
      moduleCodes: Array.isArray(license.moduleCodes) ? [...new Set(license.moduleCodes)].sort() : [],
      features: {
        validationMethod: features.validationMethod || 'Offline signed licence file',
        enforcementMode: normaliseLicenceEnforcementMode(features.enforcementMode),
        offlineGraceDays: Number(features.offlineGraceDays ?? 30),
        allowOfflineOperation: features.allowOfflineOperation === true,
      },
    },
    deployment: {
      fingerprint: license.offlineFingerprint || context.deploymentFingerprint || null,
      allowAnyFingerprint: license.offlineFingerprint ? false : true,
    },
  };
};

export const signLicensePayload = (payload, privateKeyPem, options = {}) => {
  if (!privateKeyPem) throw new Error('A private signing key is required.');
  const signedPayload = {
    ...payload,
    schema: payload?.schema || LICENSE_PAYLOAD_SCHEMA,
  };
  const signature = crypto.sign(
    null,
    Buffer.from(canonicalStringify(signedPayload)),
    crypto.createPrivateKey(normalisePem(privateKeyPem)),
  );
  return {
    schema: LICENSE_FILE_SCHEMA,
    algorithm: LICENSE_ALGORITHM,
    keyId: options.keyId || 'primary',
    payload: signedPayload,
    signature: base64urlEncode(signature),
  };
};

export const parseSignedLicenseContent = (input) => {
  if (!input) return null;
  if (typeof input === 'object' && input.features?.signedLicenseFile) {
    return parseSignedLicenseContent(input.features.signedLicenseFile);
  }
  if (typeof input === 'object' && input.schema === LICENSE_FILE_SCHEMA) return input;

  const text = String(input).trim();
  if (!text) return null;

  const parsedJson = parseJsonMaybe(text);
  if (parsedJson) {
    if (parsedJson.schema === LICENSE_FILE_SCHEMA) return parsedJson;
    if (parsedJson.features?.signedLicenseFile) return parseSignedLicenseContent(parsedJson.features.signedLicenseFile);
  }

  try {
    const decoded = base64urlDecode(text).toString('utf8');
    const parsedCompact = parseJsonMaybe(decoded);
    return parsedCompact?.schema === LICENSE_FILE_SCHEMA ? parsedCompact : null;
  } catch {
    return null;
  }
};

const describeDateWindow = (payload, now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const status = normaliseStatus(payload?.license?.status);
  const validFrom = toDateOnly(payload?.license?.validFrom);
  const validUntil = toDateOnly(payload?.license?.validUntil);

  if (status !== 'ACTIVE') {
    return { state: status || 'INACTIVE', active: false, detail: 'Licence is not active.' };
  }
  if (validFrom && validFrom > today) {
    return { state: 'FUTURE', active: false, detail: `Licence starts ${validFrom.toISOString().slice(0, 10)}.` };
  }
  if (validUntil && validUntil < today) {
    return { state: 'EXPIRED', active: false, detail: `Licence expired ${validUntil.toISOString().slice(0, 10)}.` };
  }
  if (validUntil) {
    const daysRemaining = Math.ceil((validUntil.getTime() - today.getTime()) / MS_PER_DAY);
    return {
      state: daysRemaining <= 30 ? 'EXPIRING' : 'ACTIVE',
      active: true,
      daysRemaining,
      detail: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`,
    };
  }
  return { state: 'ACTIVE', active: true, detail: 'No expiry date set.' };
};

export const verifySignedLicenseContent = (input, context = {}) => {
  const signedLicense = parseSignedLicenseContent(input);
  const deploymentFingerprint = context.deploymentFingerprint || getDeploymentFingerprint(context);
  const publicKeys = context.publicKeys || parsePublicKeysFromEnv(context.env || process.env);

  if (!signedLicense) {
    return {
      ok: false,
      signatureState: 'MISSING',
      detail: 'No signed licence file was supplied.',
      deploymentFingerprint,
    };
  }

  if (signedLicense.schema !== LICENSE_FILE_SCHEMA || signedLicense.algorithm !== LICENSE_ALGORITHM) {
    return {
      ok: false,
      signatureState: 'UNSUPPORTED_FORMAT',
      detail: 'Licence file format or signing algorithm is not supported.',
      signedLicense,
      deploymentFingerprint,
    };
  }

  if (!signedLicense.payload || !signedLicense.signature) {
    return {
      ok: false,
      signatureState: 'MALFORMED',
      detail: 'Licence file is missing a payload or signature.',
      signedLicense,
      deploymentFingerprint,
    };
  }

  if (publicKeys.length === 0) {
    return {
      ok: false,
      signatureState: 'NO_PUBLIC_KEY',
      detail: 'No licence public key is configured on this deployment.',
      signedLicense,
      deploymentFingerprint,
    };
  }

  const keysToTry = signedLicense.keyId
    ? publicKeys.filter((key) => key.keyId === signedLicense.keyId || publicKeys.length === 1)
    : publicKeys;
  const signature = base64urlDecode(signedLicense.signature);
  const payloadBytes = Buffer.from(canonicalStringify(signedLicense.payload));
  const matchedKey = keysToTry.find((key) => {
    try {
      return crypto.verify(null, payloadBytes, crypto.createPublicKey(normalisePem(key.publicKeyPem)), signature);
    } catch {
      return false;
    }
  });

  if (!matchedKey) {
    return {
      ok: false,
      signatureState: 'INVALID_SIGNATURE',
      detail: 'Licence signature does not match the configured public key.',
      signedLicense,
      deploymentFingerprint,
    };
  }

  const expectedFingerprint = signedLicense.payload?.deployment?.fingerprint;
  const allowAnyFingerprint = signedLicense.payload?.deployment?.allowAnyFingerprint === true;
  if (expectedFingerprint && !allowAnyFingerprint && expectedFingerprint !== deploymentFingerprint) {
    return {
      ok: false,
      signatureState: 'FINGERPRINT_MISMATCH',
      detail: `Licence is bound to ${expectedFingerprint}, but this deployment fingerprint is ${deploymentFingerprint}.`,
      signedLicense,
      payload: signedLicense.payload,
      keyId: matchedKey.keyId,
      deploymentFingerprint,
    };
  }

  const dateWindow = describeDateWindow(signedLicense.payload, context.now || new Date());
  return {
    ok: dateWindow.active,
    signatureState: 'VERIFIED',
    detail: dateWindow.detail,
    dateState: dateWindow.state,
    signedLicense,
    payload: signedLicense.payload,
    keyId: matchedKey.keyId,
    deploymentFingerprint,
  };
};

const describeUnsignedRecord = (license, context = {}) => {
  const payload = buildLicensePayloadFromRecord(license, context);
  const dateWindow = describeDateWindow(payload, context.now || new Date());
  return {
    ok: dateWindow.active,
    signatureState: 'UNSIGNED_CONFIGURATION',
    detail: 'This licence is a database configuration record. It is acceptable for development, but production/offline customer deployments should use a signed licence file.',
    dateState: dateWindow.state,
    payload,
    deploymentFingerprint: context.deploymentFingerprint || getDeploymentFingerprint(context),
  };
};

const buildLicenseSummary = (license, verification) => ({
  id: license.id,
  licenseKey: license.licenseKey,
  licenseName: license.licenseName,
  organisationCode: license.organisationCode,
  deploymentMode: license.deploymentMode,
  state: verification.dateState || verification.signatureState || 'UNKNOWN',
  detail: verification.detail,
  moduleCount: Array.isArray(license.moduleCodes) ? license.moduleCodes.length : 0,
  validationMethod: license.features?.validationMethod || verification.payload?.license?.features?.validationMethod || null,
  enforcementMode: normaliseLicenceEnforcementMode(license.features?.enforcementMode || verification.payload?.license?.features?.enforcementMode),
  allowOfflineOperation: license.features?.allowOfflineOperation === true || verification.payload?.license?.features?.allowOfflineOperation === true,
  hasOfflineFingerprint: Boolean(license.offlineFingerprint || verification.payload?.deployment?.fingerprint),
  signatureState: verification.signatureState,
  signatureDetail: verification.detail,
  signed: verification.signatureState === 'VERIFIED',
  validForThisDeployment: verification.ok === true,
});

export const evaluateCommercialLicenses = ({
  licenses = [],
  modules = [],
  organisations = [],
  packageMetadata = {},
  now = new Date(),
  env = process.env,
} = {}) => {
  const activeOrganisation = organisations.find((org) => normaliseStatus(org.status) === 'ACTIVE') || organisations[0] || {};
  const organisationCode = activeOrganisation.code || licenses[0]?.organisationCode || 'UNKNOWN';
  const deploymentProfile = activeOrganisation.settings?.deploymentProfile || {};
  const operationalRunbook = activeOrganisation.settings?.operationalRunbook || {};
  const deploymentFingerprint = getDeploymentFingerprint({
    organisationCode,
    organisation: activeOrganisation,
    deploymentProfile,
    operationalRunbook,
    packageMetadata,
  }, env);
  const runtimeMode = getLicenseRuntimeMode(env);
  const publicKeys = parsePublicKeysFromEnv(env);

  const evaluations = licenses.map((license) => {
    const signedLicense = license.features?.signedLicenseFile || license.features?.importedSignedLicense || null;
    const verification = signedLicense
      ? verifySignedLicenseContent(signedLicense, { deploymentFingerprint, publicKeys, now, packageMetadata })
      : describeUnsignedRecord(license, { deploymentFingerprint, now, packageMetadata });
    return { license, verification };
  });

  const productionLike = runtimeMode === 'production';
  const validEvaluations = evaluations.filter(({ verification }) => {
    if (!verification.ok) return false;
    if (productionLike) return verification.signatureState === 'VERIFIED';
    return true;
  });

  const activeLicenses = validEvaluations.map(({ license }) => license);
  const licensedModuleCodes = Array.from(new Set(
    validEvaluations.flatMap(({ license, verification }) => {
      const signedCodes = verification.payload?.license?.moduleCodes;
      return Array.isArray(signedCodes) ? signedCodes : (Array.isArray(license.moduleCodes) ? license.moduleCodes : []);
    }),
  )).sort();
  const licensedModules = modules.filter((module) => licensedModuleCodes.includes(module.code));
  const deploymentModes = Array.from(new Set(validEvaluations
    .map(({ license, verification }) => verification.payload?.license?.deploymentMode || license.deploymentMode)
    .filter(Boolean))).sort();
  const enforcementMode = normaliseLicenceEnforcementMode(deploymentProfile.enforcementMode || activeLicenses[0]?.features?.enforcementMode);
  const shouldBlock = productionLike && enforcementMode === 'Block Expired Licence' && validEvaluations.length === 0;
  const verifiedLicenseCount = evaluations.filter(({ verification }) => verification.signatureState === 'VERIFIED').length;
  const unsignedLicenseCount = evaluations.filter(({ verification }) => verification.signatureState === 'UNSIGNED_CONFIGURATION').length;
  const invalidLicenseCount = evaluations.filter(({ verification }) => (
    verification.signatureState !== 'VERIFIED' &&
    verification.signatureState !== 'UNSIGNED_CONFIGURATION'
  )).length;

  return {
    hasActiveLicense: activeLicenses.length > 0,
    activeLicenseCount: activeLicenses.length,
    deploymentModes,
    licensedModuleCodes,
    licensedModules,
    licenseSummaries: evaluations.map(({ license, verification }) => buildLicenseSummary(license, verification)),
    runtimeMode,
    developmentBypass: runtimeMode !== 'production',
    enforcementMode,
    shouldBlock,
    deploymentFingerprint,
    publicKeyConfigured: publicKeys.length > 0,
    verifiedLicenseCount,
    unsignedLicenseCount,
    invalidLicenseCount,
    message: runtimeMode === 'production'
      ? (shouldBlock ? 'Licence enforcement would block this deployment because no valid signed licence is active.' : 'Production licence enforcement is available and a valid signed licence is active.')
      : 'Development licensing mode is active. Signed licences can be tested, but access is not blocked while building, cloning or testing the app.',
  };
};

export const buildImportedLicenseRecord = (signedLicenseInput, context = {}) => {
  const verification = verifySignedLicenseContent(signedLicenseInput, context);
  if (verification.signatureState !== 'VERIFIED') {
    throw new Error(verification.detail || 'Signed licence could not be verified.');
  }
  const payload = verification.payload;
  const license = payload.license || {};
  const customer = payload.customer || {};
  const deployment = payload.deployment || {};
  const signedLicense = verification.signedLicense;

  return {
    organisationCode: customer.organisationCode || context.organisationCode || 'UNKNOWN',
    licenseKey: license.licenseKey,
    licenseName: license.licenseName || license.licenseKey,
    deploymentMode: license.deploymentMode || 'Fully Offline',
    status: license.status || 'ACTIVE',
    validFrom: license.validFrom || null,
    validUntil: license.validUntil || null,
    maxUsers: license.maxUsers ?? null,
    maxUnits: license.maxUnits ?? null,
    maxAircraftTypes: license.maxAircraftTypes ?? null,
    moduleCodes: Array.isArray(license.moduleCodes) ? license.moduleCodes : [],
    offlineFingerprint: deployment.fingerprint || null,
    notes: `Imported signed licence ${license.licenseKey || ''}`.trim(),
    features: {
      ...(license.features || {}),
      signedLicenseFile: signedLicense,
      signatureStatus: verification.signatureState,
      signatureDetail: verification.detail,
      signatureKeyId: verification.keyId || signedLicense.keyId || null,
      importedAt: new Date().toISOString(),
    },
  };
};
