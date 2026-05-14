# DFP-NEO Licensing

This app now has a signed licence foundation that supports online SaaS, private defence network, hybrid, and fully offline customer deployments while remaining non-blocking in development.

## Current Development Behaviour

The default runtime mode is `development`.

In development:

- The app continues to run even if no signed licence is installed.
- Existing database licence records are accepted as development configuration.
- Signed licence files can still be verified and imported end to end.
- Clones, test branches, Railway test deployments, and local builds are not blocked.

To move a customer deployment towards enforcement, set:

```bash
DFP_LICENSE_MODE=production
```

Production mode requires a valid signed licence for true enforcement decisions. Keep this unset while building and testing.

The server now includes a production enforcement gate. In development it only reports licence state. In production it can block operational API calls when the deployment profile is set to `Block Expired Licence` and no valid signed licence is active. Login, licence import/status, the deployment manifest, and platform configuration remain reachable so an administrator can recover a deployment.

## Security Model

The licensing design uses asymmetric signing:

- The vendor keeps the private signing key offline.
- Customer deployments receive only the public key.
- A licence file is a signed JSON document.
- The app verifies the signature using the public key.
- If a customer edits the licence file, the signature fails.

This means fully offline deployments can validate licences without contacting your servers.

## Environment Variables

Customer deployments should receive:

```bash
DFP_LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
DFP_LICENSE_KEY_ID=primary
DFP_LICENSE_MODE=development
```

For production enforcement later:

```bash
DFP_LICENSE_MODE=production
```

Optional strict mode:

```bash
DFP_LICENSE_FAIL_CLOSED=true
```

Use fail-closed only for accredited customer environments. It rejects operational API calls if the server cannot check licence status.

Do not deploy `DFP_LICENSE_PRIVATE_KEY` to customer environments. The private key is for your licence-issuing workstation or private licence service only.

## Generate A Signing Keypair

Run this once from a safe vendor machine:

```bash
node scripts/generate-license-keypair.mjs --out ./dfp-neo-license-keypair.json
```

Store the private key securely. Put the public key into the customer deployment environment variable `DFP_LICENSE_PUBLIC_KEY`.

## Find A Deployment Fingerprint

In the running app, open:

```text
/api/platform-license/fingerprint
```

The `deploymentFingerprint` value can be used to bind an offline licence to a specific deployed installation.

For early testing, you can issue a licence with `--allow-any-fingerprint`, but customer offline licences should normally be fingerprint-bound.

## Generate A Signed Offline Licence

Save the private key from the generated keypair into a PEM file, then run:

```bash
node scripts/generate-license.mjs \
  --private-key ./licence-private.pem \
  --output ./raaf-esl-offline.license.json \
  --license-key RAAF-ESL-001 \
  --license-name "RAAF ESL Offline" \
  --organisation-code RAAF \
  --organisation-name "Royal Australian Air Force" \
  --deployment-mode "Fully Offline" \
  --modules DFP,NEO_BUILD,TRAINING,REPORTING \
  --fingerprint DFP-EXAMPLEFINGERPRINT \
  --offline \
  --valid-from 2026-05-14 \
  --valid-until 2027-05-14 \
  --max-users 250 \
  --max-units 12 \
  --max-aircraft-types 8 \
  --enforcement-mode "Block Expired Licence"
```

The output file can be imported in Settings -> Platform Configuration -> Licensing & Deployment.

## Online SaaS Option

The same signed licence file format works for SaaS. Later, you can add a small licence-issuing service that stores customers, issues signed licences, and optionally lets SaaS deployments check licence status online.

That external service is optional. It can be built later. The app does not need it for offline or development use.

## Offline Deployment Requirements

A fully offline deployment needs:

- Local web server.
- Local PostgreSQL database.
- Local authentication.
- Local file storage.
- Public licence key installed in the app environment.
- Signed offline licence imported into the database.
- Backup and restore process documented in Platform Configuration.

No internet connection is required for signature validation.

## Tamper Prevention

Customers can view a signed licence, but they cannot safely change it:

- Changing licensed modules invalidates the signature.
- Changing expiry date invalidates the signature.
- Changing user/unit limits invalidates the signature.
- Changing deployment fingerprint invalidates the signature.

The only party able to produce a valid modified licence is the holder of the private signing key.

## Recommended Commercial Path

Use this in development now:

```bash
DFP_LICENSE_MODE=development
```

For customer pilots:

```bash
DFP_LICENSE_MODE=development
```

Import signed licences and monitor warnings without blocking.

For production customer enforcement:

```bash
DFP_LICENSE_MODE=production
```

Set the deployment profile enforcement mode to `Warn Only` or `Block Expired Licence` when you are ready.
