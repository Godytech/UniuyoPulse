import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp();

const [uid, role, department, studentId, faculty = '', level = ''] = process.argv.slice(2);
const validRoles = ['student', 'lecturer', 'course_rep_admin', 'assistant_course_rep', 'rep_admin'];
if (!uid || !validRoles.includes(role) || !department?.trim() || !studentId?.trim()) {
  throw new Error(
    'Usage: node scripts/migrate-existing-user.js <verified-auth-uid> <role> <department> <registration-or-staff-id> [faculty] [level]'
  );
}
if (role === 'student' && (!faculty.trim() || !level.trim())) {
  throw new Error('Student migration requires faculty and level.');
}

const auth = getAuth();
const user = await auth.getUser(uid);
if (!user.emailVerified || !user.email) {
  throw new Error('The account must have a verified email address.');
}

const db = getFirestore();
const profileRef = db.collection('userProfiles').doc(uid);
const studentRef = db.collection('students').doc(uid);
const profile = await db.runTransaction(async (transaction) => {
  const [profileSnapshot, studentSnapshot] = await Promise.all([
    transaction.get(profileRef),
    transaction.get(studentRef)
  ]);
  const existing = profileSnapshot.exists ? profileSnapshot.data() : {};
  if (
    profileSnapshot.exists &&
    (existing.email?.toLowerCase() !== user.email.toLowerCase() ||
      existing.role !== role ||
      existing.department !== department.trim())
  ) {
    throw new Error('Existing account details do not match the verified migration input.');
  }

  const trustedProfile = {
    ...existing,
    id: uid,
    uid,
    email: user.email.toLowerCase(),
    fullName: existing.fullName || user.displayName || user.email,
    role,
    studentId: studentId.trim().toUpperCase(),
    department: department.trim(),
    faculty: role === 'student' ? faculty.trim() : existing.faculty || faculty.trim(),
    level: role === 'student' ? level.trim() : existing.level || level.trim(),
    createdAt: existing.createdAt || new Date().toISOString()
  };

  transaction.set(profileRef, trustedProfile);
  if (role !== 'lecturer') {
    const existingStudent = studentSnapshot.exists ? studentSnapshot.data() : {};
    transaction.set(studentRef, {
      ...existingStudent,
      id: uid,
      role,
      fullName: trustedProfile.fullName,
      studentId: trustedProfile.studentId,
      department: trustedProfile.department,
      faculty: trustedProfile.faculty,
      level: trustedProfile.level,
      email: trustedProfile.email,
      avatar: 'assets/uniuyo-logo.png',
      attendanceRate: existingStudent.attendanceRate ?? 0,
      presentCount: existingStudent.presentCount ?? 0,
      lateCount: existingStudent.lateCount ?? 0,
      absentCount: existingStudent.absentCount ?? 0,
      status: existingStudent.status || 'Good Standing',
      enrolledCourses: existingStudent.enrolledCourses || []
    }, { merge: true });
  }
  return trustedProfile;
});

await auth.setCustomUserClaims(uid, {
  ...user.customClaims,
  role,
  department: profile.department
});
await db.collection('securityAudit').add({
  action: 'migrate_existing_user',
  uid,
  role,
  department: profile.department,
  timestamp: FieldValue.serverTimestamp()
});

console.log('Existing account migrated. Sign out and back in to refresh access.');
