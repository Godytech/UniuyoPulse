import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp();

const [uid, department, staffId] = process.argv.slice(2);
if (!uid || !department?.trim() || !staffId?.trim()) {
  throw new Error('Usage: node scripts/bootstrap-lecturer.js <verified-auth-uid> <department> <staff-id>');
}

const auth = getAuth();
const user = await auth.getUser(uid);
if (!user.emailVerified || !user.email) {
  throw new Error('The bootstrap account must have a verified email address.');
}

const firestore = getFirestore();
const profileRef = firestore.collection('userProfiles').doc(uid);
const existingProfile = await profileRef.get();
const profile = {
  ...(existingProfile.exists ? existingProfile.data() : {}),
  id: uid,
  uid,
  email: user.email.toLowerCase(),
  fullName: user.displayName || user.email,
  role: 'lecturer',
  studentId: staffId.trim().toUpperCase(),
  department: department.trim(),
  faculty: '',
  level: '',
  createdAt: new Date().toISOString()
};

await profileRef.set(profile);
await auth.setCustomUserClaims(uid, {
  ...user.customClaims,
  role: 'lecturer',
  department: profile.department
});
await firestore.collection('securityAudit').add({
  action: 'bootstrap_lecturer',
  uid,
  department: profile.department,
  timestamp: FieldValue.serverTimestamp()
});

console.log('Lecturer role bootstrapped. Sign out and sign back in to refresh access.');
