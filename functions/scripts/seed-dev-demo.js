import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.DEMO_FIREBASE_PROJECT_ID;
if (process.env.SEED_UNIUYO_DEMO !== 'yes' || !projectId) {
  throw new Error('Set SEED_UNIUYO_DEMO=yes and DEMO_FIREBASE_PROJECT_ID to explicitly target a demo Firebase project.');
}

const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const password = () => `Demo-${randomBytes(18).toString('base64url')}!`;
const now = Date.now();
const point = { latitude: 0.1, longitude: 0.1 };
const departments = [
  { name: 'Computer Science', faculty: 'Faculty of Science', code: 'CSC' },
  { name: 'Mathematics', faculty: 'Faculty of Science', code: 'MTH' },
  { name: 'Physics', faculty: 'Faculty of Science', code: 'PHY' },
  { name: 'English', faculty: 'Faculty of Arts', code: 'ENG' }
];
const faculties = [
  { id: 'faculty-science-demo', name: 'Faculty of Science', departments: ['Computer Science', 'Mathematics', 'Physics'], isDemoData: true },
  { id: 'faculty-arts-demo', name: 'Faculty of Arts', departments: ['English'], isDemoData: true }
];
const demoCredentials = [];
const profiles = [];
const courses = [];
const sessions = [];
const timetable = [];
const students = [];
const records = [];
const notifications = [];

async function createAccount({ email, name, role, department, faculty, level, studentId }) {
  let user;
  let passwordValue = '';
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    passwordValue = password();
    user = await auth.createUser({
      email,
      password: passwordValue,
      displayName: name,
      emailVerified: true
    });
  }
  if (passwordValue) demoCredentials.push({ email, password: passwordValue, role, department });
  const profile = {
    id: user.uid,
    uid: user.uid,
    email,
    fullName: name,
    role,
    department,
    faculty,
    level,
    studentId,
    active: true,
    demoAuthAccount: role !== 'dev_admin',
    isDemoData: role !== 'dev_admin',
    createdAt: new Date().toISOString()
  };
  await db.collection('userProfiles').doc(user.uid).set(profile);
  await auth.setCustomUserClaims(user.uid, { role, department, faculty, level });
  profiles.push(profile);
  return profile;
}

for (let index = 0; index < departments.length; index += 1) {
  const department = departments[index];
  const lecturer = await createAccount({
    email: `lecturer.${department.code.toLowerCase()}.demo@uniuyo.edu.ng`,
    name: `Demo Lecturer ${department.name}`,
    role: 'lecturer',
    department: department.name,
    faculty: department.faculty,
    level: '',
    studentId: `STAFF-DEMO-${department.code}`
  });
  const rep = await createAccount({
    email: `rep.${department.code.toLowerCase()}.demo@uniuyo.edu.ng`,
    name: `Demo Course Rep ${department.name}`,
    role: 'course_rep_admin',
    department: department.name,
    faculty: department.faculty,
    level: '200L',
    studentId: `REP-DEMO-${department.code}`
  });
  const courseId = `demo-course-${department.code.toLowerCase()}`;
  const course = {
    id: courseId,
    semesterId: 'demo-semester-2025-2026',
    semesterName: 'First Semester 2025/2026',
    code: `${department.code} 221`,
    title: `Introduction to ${department.name}`,
    department: department.name,
    faculty: department.faculty,
    level: '200L',
    repId: rep.id,
    repName: rep.fullName,
    scheduleDay: 'Monday',
    scheduleTime: '10:00 - 11:00',
    classroom: `Demo ${department.code} Hall`,
    enrolledStudentCount: 20,
    isDemoData: true
  };
  courses.push(course);
  timetable.push({
    id: `demo-timetable-${department.code.toLowerCase()}`,
    semesterId: 'demo-semester-2025-2026',
    semesterName: 'First Semester 2025/2026',
    department: department.name,
    faculty: department.faculty,
    level: '200L',
    day: 'Monday',
    time: '10:00',
    endTime: '11:00',
    courseCode: course.code,
    courseTitle: course.title,
    location: course.classroom,
    isDemoData: true
  });
  for (let studentIndex = 0; studentIndex < 2; studentIndex += 1) {
    const regNo = `DEMO/${department.code}/${studentIndex + 1}`;
    const student = await createAccount({
      email: `student.${department.code.toLowerCase()}.${studentIndex + 1}.demo@uniuyo.edu.ng`,
      name: `Demo Student ${department.name} ${studentIndex + 1}`,
      role: 'student',
      department: department.name,
      faculty: department.faculty,
      level: '200L',
      studentId: regNo
    });
    students.push({
      id: student.id,
      role: student.role,
      fullName: student.fullName,
      studentId: regNo,
      department: department.name,
      faculty: department.faculty,
      level: '200L',
      email: student.email,
      avatar: 'assets/uniuyo-logo.png',
      attendanceRate: studentIndex === 0 ? 80 : 60,
      presentCount: studentIndex === 0 ? 4 : 3,
      lateCount: 1,
      absentCount: studentIndex === 0 ? 1 : 2,
      status: studentIndex === 0 ? 'Good Standing' : 'Warning',
      enrolledCourses: [],
      isDemoData: true
    });
  }

  const durations = [
    { name: 'live', start: now - 15 * 60000, end: now + 45 * 60000, status: 'active' },
    { name: 'stale', start: now - 90 * 60000, end: now - 30 * 60000, status: 'active' },
    { name: 'closed', start: now - 150 * 60000, end: now - 90 * 60000, status: 'closed' },
    { name: 'scheduled', start: now + 30 * 60000, end: now + 90 * 60000, status: 'scheduled' }
  ];
  const duration = durations[index];
  const sessionId = `demo-session-${duration.name}`;
  sessions.push({
    id: sessionId,
    courseId,
    courseCode: course.code,
    courseTitle: course.title,
    semesterId: course.semesterId,
    semesterName: course.semesterName,
    courseLevel: course.level,
    department: department.name,
    faculty: department.faculty,
    locationName: course.classroom,
    ...point,
    radiusMeters: 50,
    startTime: new Date(duration.start).toISOString(),
    endTime: new Date(duration.end).toISOString(),
    lateThresholdMinutes: 15,
    status: duration.status,
    pinLength: 6,
    maxStudents: 20,
    totalAttendees: 2,
    lecturerName: rep.fullName,
    lecturerId: rep.id,
    createdAt: new Date(duration.start).toISOString(),
    isDemoData: true
  });
  if (duration.status !== 'closed') {
    await db.collection('sessionSecrets').doc(sessionId).set({
      accessCode: '482196',
      department: department.name,
      createdBy: rep.id,
      isDemoData: true
    });
  }
  notifications.push({
    id: `demo-notification-${index}`,
    type: 'session_opened',
    title: 'Demo session opened',
    body: `${rep.fullName} opened ${course.code}.`,
    timestamp: new Date(duration.start).toISOString(),
    read: false,
    courseCode: course.code,
    sessionId,
    department: department.name,
    faculty: department.faculty,
    isDemoData: true
  });
}

for (const faculty of faculties) await db.collection('faculties').doc(faculty.id).set(faculty);
for (const course of courses) await db.collection('courses').doc(course.id).set(course);
for (const item of timetable) await db.collection('timetable').doc(item.id).set(item);
for (const session of sessions) await db.collection('sessions').doc(session.id).set(session);
for (const student of students) await db.collection('students').doc(student.id).set(student);
for (const notification of notifications) await db.collection('notifications').doc(notification.id).set(notification);

for (const session of sessions) {
  const department = departments.find((item) => item.name === session.department);
  const profilesInDepartment = profiles.filter((profile) => profile.department === session.department && profile.role === 'student');
  for (const [index, student] of profilesInDepartment.entries()) {
    const recordId = `${session.id}_${student.id}`;
    records.push({
      id: recordId,
      sessionId: session.id,
      courseId: session.courseId,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      department: session.department,
      faculty: department?.faculty ?? '',
      semesterId: session.semesterId,
      semesterName: session.semesterName,
      studentId: student.id,
      studentName: student.fullName,
      studentRegNo: student.studentId,
      status: index === 0 ? 'present' : 'late',
      ...point,
      locationAccuracyMeters: 8,
      distanceFromClassMeters: index === 0 ? 8 : 47,
      submittedAt: new Date(Date.parse(session.startTime) + (index + 1) * 60000).toISOString(),
      deviceFingerprint: 'demo-shared-device-token',
      verifiedByServer: true,
      verificationMethod: 'gps_code',
      isDemoData: true
    });
  }
}
for (const record of records) await db.collection('records').doc(record.id).set(record);

for (const [index, session] of sessions.entries()) {
  const audit = {
    id: `demo-audit-${index}`,
    timestamp: session.createdAt,
    actorId: session.lecturerId,
    actorName: session.lecturerName,
    actorRole: 'course_rep_admin',
    action: 'session.created',
    targetType: 'session',
    targetId: session.id,
    details: `Demo session seeded in ${session.status} state.`,
    isDemoData: true
  };
  await db.collection('auditLog').doc(audit.id).set(audit);
}

await db.collection('appConfig').doc('devSettings').set({
  id: 'devSettings',
  minRadiusMeters: 10,
  maxGpsAccuracyMeters: 50,
  lateThresholdMinutes: 15,
  pinLength: 6,
  semesterName: 'First Semester 2025/2026',
  featureFlags: { anomalyAlerts: true, managementBroadcasts: true },
  demoMode: true,
  seededAt: FieldValue.serverTimestamp()
});

console.log('Demo institution data seeded. Unique temporary student, lecturer, and course-rep credentials (save privately):');
for (const credential of demoCredentials) {
  console.log(`${credential.role}\t${credential.department || 'institution'}\t${credential.email}\t${credential.password}`);
}
console.log(`Created ${faculties.length} faculties, ${departments.length} departments, ${sessions.length} sessions (live, stale, closed, scheduled), ${students.length} students and ${records.length} records.`);
