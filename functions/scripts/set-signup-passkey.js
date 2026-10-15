import { randomBytes, scryptSync } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.SIGNUP_PASSKEY_PROJECT_ID?.trim();
const rotationConfirmation = process.env.CONFIRM_SIGNUP_PASSKEY_ROTATION;
if (!projectId || (rotationConfirmation !== undefined && rotationConfirmation !== 'yes')) {
  throw new Error('Set SIGNUP_PASSKEY_PROJECT_ID. To rotate an existing key, also set CONFIRM_SIGNUP_PASSKEY_ROTATION=yes.');
}

const app = initializeApp({ projectId });
const db = getFirestore(app);
const configRef = db.collection('appConfig').doc('registrationAuthorization');
const existingConfig = await configRef.get();
if (existingConfig.exists && rotationConfirmation !== 'yes') {
  throw new Error('A signup passkey already exists. Set CONFIRM_SIGNUP_PASSKEY_ROTATION=yes to rotate it.');
}
const passkey = randomBytes(32).toString('base64url');
const salt = randomBytes(16);
const passkeyHash = scryptSync(passkey, salt, 64, { N: 16384, r: 8, p: 1 });
await configRef.set({
  passkeySalt: salt.toString('base64url'),
  passkeyHash: passkeyHash.toString('base64url'),
  scryptN: 16384,
  scryptR: 8,
  scryptP: 1,
  updatedAt: FieldValue.serverTimestamp()
});

console.log(`Student/Lecturer signup passkey for ${projectId} (save securely; it is shown only once):`);
console.log(passkey);
console.log('This shared passkey allows registrations for the selected Student or Lecturer role.');
