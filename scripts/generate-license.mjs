import fs from 'fs';
import { parseArgs } from 'util';
import {
  LICENSE_PAYLOAD_SCHEMA,
  normaliseLicenceEnforcementMode,
  signLicensePayload,
} from '../lib/licensing.js';

const usage = `
Usage:
  node scripts/generate-license.mjs --private-key ./licence-private.pem --output ./customer.license.json \\
    --license-key RAAF-ESL-001 --license-name "RAAF ESL Offline" --organisation-code RAAF \\
    --deployment-mode "Fully Offline" --modules DFP,NEO_BUILD,TRAINING --fingerprint DFP-ABC123

Input modes:
  --input ./payload.json              Sign a prepared licence payload JSON file.
  --private-key ./private.pem         Private Ed25519 PEM file used by the vendor only.
  --private-key-env                   Read private key from DFP_LICENSE_PRIVATE_KEY instead.

Common options when not using --input:
  --license-key <key>                 Customer-visible licence key.
  --license-name <name>               Customer-visible licence name.
  --organisation-code <code>          Example: RAAF.
  --organisation-name <name>          Example: Royal Australian Air Force.
  --deployment-mode <mode>            Online SaaS, Private Defence Network, Fully Offline, Hybrid Offline Sync.
  --valid-from yyyy-mm-dd             Licence start date.
  --valid-until yyyy-mm-dd            Licence expiry date.
  --modules A,B,C                     Licensed module codes.
  --fingerprint <fingerprint>         Bind licence to one deployment fingerprint.
  --allow-any-fingerprint             Allow use on any deployment. Useful only for development/test.
  --offline                           Mark licence as allowing offline operation.
  --max-users <n>                     Optional licensed user limit.
  --max-units <n>                     Optional licensed unit limit.
  --max-aircraft-types <n>            Optional aircraft type limit.
  --enforcement-mode <mode>           Monitor Only, Warn Only, Block Expired Licence.
  --offline-grace-days <n>            Offline grace period metadata.
  --key-id <id>                       Public key identifier, default primary.
`;

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    'private-key': { type: 'string' },
    'private-key-env': { type: 'boolean' },
    'license-key': { type: 'string' },
    'license-name': { type: 'string' },
    'organisation-code': { type: 'string' },
    'organisation-name': { type: 'string' },
    'deployment-mode': { type: 'string' },
    'valid-from': { type: 'string' },
    'valid-until': { type: 'string' },
    modules: { type: 'string' },
    fingerprint: { type: 'string' },
    'allow-any-fingerprint': { type: 'boolean' },
    offline: { type: 'boolean' },
    'max-users': { type: 'string' },
    'max-units': { type: 'string' },
    'max-aircraft-types': { type: 'string' },
    'enforcement-mode': { type: 'string' },
    'offline-grace-days': { type: 'string' },
    'key-id': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
});

if (values.help) {
  console.log(usage.trim());
  process.exit(0);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, received ${value}`);
  return parsed;
};

const moduleCodes = String(values.modules || '')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);

const buildPayloadFromArgs = () => {
  if (!values['license-key']) throw new Error('--license-key is required when --input is not used.');
  const allowAnyFingerprint = values['allow-any-fingerprint'] === true;
  if (!allowAnyFingerprint && !values.fingerprint) {
    throw new Error('--fingerprint is required unless --allow-any-fingerprint is supplied.');
  }

  return {
    schema: LICENSE_PAYLOAD_SCHEMA,
    issuedAt: new Date().toISOString(),
    application: {
      application: 'daily-flying-program',
      version: 'customer-package',
      deploymentFingerprint: values.fingerprint || null,
    },
    customer: {
      organisationCode: values['organisation-code'] || 'UNKNOWN',
      organisationName: values['organisation-name'] || values['organisation-code'] || 'UNKNOWN',
    },
    license: {
      licenseKey: values['license-key'],
      licenseName: values['license-name'] || values['license-key'],
      deploymentMode: values['deployment-mode'] || (values.offline ? 'Fully Offline' : 'Online SaaS'),
      status: 'ACTIVE',
      validFrom: values['valid-from'] || null,
      validUntil: values['valid-until'] || null,
      maxUsers: toNumberOrNull(values['max-users']),
      maxUnits: toNumberOrNull(values['max-units']),
      maxAircraftTypes: toNumberOrNull(values['max-aircraft-types']),
      moduleCodes,
      features: {
        validationMethod: values.offline ? 'Offline signed licence file' : 'Online licence check',
        enforcementMode: normaliseLicenceEnforcementMode(values['enforcement-mode']),
        offlineGraceDays: toNumberOrNull(values['offline-grace-days']) ?? 30,
        allowOfflineOperation: values.offline === true,
      },
    },
    deployment: {
      fingerprint: values.fingerprint || null,
      allowAnyFingerprint,
    },
  };
};

const privateKeyPem = values['private-key-env']
  ? process.env.DFP_LICENSE_PRIVATE_KEY
  : (values['private-key'] ? fs.readFileSync(values['private-key'], 'utf8') : '');

if (!privateKeyPem) {
  throw new Error('A private signing key is required. Use --private-key or --private-key-env.');
}

const payload = values.input ? readJson(values.input) : buildPayloadFromArgs();
const signedLicense = signLicensePayload(payload, privateKeyPem, {
  keyId: values['key-id'] || 'primary',
});
const output = `${JSON.stringify(signedLicense, null, 2)}\n`;

if (values.output) {
  fs.writeFileSync(values.output, output, 'utf8');
  console.log(`Wrote signed licence to ${values.output}`);
} else {
  console.log(output);
}
