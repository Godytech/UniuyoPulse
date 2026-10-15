import { createHash, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();

const [email, role, department, studentId, faculty = '', level = ''] = process.argv.slice(2);
if (
  !email ||
  !['student', 'lecturer'].includes(role) ||
  !department?.trim() ||
  !studentId?.trim() ||
  (role === 'student' && (!faculty.trim() || !level.trim()))
) {
  throw new Error(
    'Usage: node scripts/issue-registration-invitation.js <email> <student|lecturer> <department> <registration-or-staff-id> [faculty] [level]'
  );
}

const code = randomBytes(32).toString('base64url');
const codeHash = createHash('sha256').update(code).digest('hex');
const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
await getFirestore().collection('registrationInvitations').doc(codeHash).create({
  email: email.trim().toLowerCase(),
  role,
  department: department.trim(),
  studentId: studentId.trim().toUpperCase(),
  faculty: faculty.trim(),
  level: level.trim(),
  expiresAt,
  createdAt: FieldValue.serverTimestamp(),
  usedAt: null,
  usedBy: null
});

console.log(`Send this single-use invitation to ${email.trim().toLowerCase()}: ${code}`);
