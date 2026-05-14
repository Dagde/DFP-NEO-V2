import crypto from 'crypto';
import fs from 'fs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputPath = outIndex >= 0 ? args[outIndex + 1] : '';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const keypair = {
  algorithm: 'Ed25519',
  generatedAt: new Date().toISOString(),
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  notes: [
    'Keep privateKeyPem offline and secret. Do not deploy it with the app.',
    'Deploy publicKeyPem to customer environments as DFP_LICENSE_PUBLIC_KEY.',
  ],
};

const text = `${JSON.stringify(keypair, null, 2)}\n`;

if (outputPath) {
  fs.writeFileSync(outputPath, text, 'utf8');
  console.log(`Wrote Ed25519 licence keypair to ${outputPath}`);
} else {
  console.log(text);
}
