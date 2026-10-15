import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const db = getFirestore();
const auth = getAuth();
const allowedStudentRoles = ['student', 'course_rep_admin', 'assistant_course_rep', 'rep_admin'];
const staffRoles = ['lecturer', 'course_rep_admin', 'assistant_course_rep', 'rep_admin'];

function requireUser(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before performing this action.');
  }
  return request.auth;
}

async function requireStaff(request, requiredRoles = staffRoles) {
  const user = requireUser(request);
  const { role, department } = user.token;
  if (
    !user.token.email_verified ||
    !requiredRoles.includes(role) ||
    typeof department !== 'string' ||
    !department
  ) {
    throw new HttpsError('permission-denied', 'You are not authorized to perform this action.');
  }
  const profile = await db.collection('userProfiles').doc(user.uid).get();
  if (
    !profile.exists ||
    profile.data().role !== role ||
    profile.data().department !== department ||
    profile.data().active === false
  ) {
    throw new HttpsError('permission-denied', 'Your account permissions are no longer current.');
  }
  return { ...user, role, department, profile: profile.data() };
}

async function requireDevAdmin(request) {
  const user = requireUser(request);
  if (!user.token.email_verified || user.token.role !== 'dev_admin') {
    throw new HttpsError('permission-denied', 'Dev administrator access is required.');
  }
  const profile = await db.collection('userProfiles').doc(user.uid).get();
  if (!profile.exists || profile.data().role !== 'dev_admin' || profile.data().active === false) {
    throw new HttpsError('permission-denied', 'Your dev administrator access is no longer active.');
  }
  return { ...user, role: 'dev_admin', profile: profile.data() };
}

async function writeAudit(actor, action, targetType, targetId, details) {
  const entry = {
    id: `audit_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorId: actor.uid,
    actorName: actor.profile?.fullName ?? actor.fullName ?? actor.token?.name ?? '',
    actorRole: actor.role ?? actor.token?.role ?? 'dev_admin',
    action,
    targetType,
    targetId,
    details
  };
  await db.collection('auditLog').doc(entry.id).set(entry);
  return entry;
}

function text(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpsError('invalid-argument', `${label} is invalid.`);
  }
  return value.trim();
}

function documentId(value, label) {
  const id = text(value, label, 128);
  if (id.includes('/')) {
    throw new HttpsError('invalid-argument', `${label} is invalid.`);
  }
  return id;
}

async function verifyAuthorizationPasskey(request, passkey, configId, attemptsCollection, roleLabel) {
  if (typeof passkey !== 'string' || passkey.length < 12 || passkey.length > 256) {
    throw new HttpsError('permission-denied', `${roleLabel} authorization could not be verified.`);
  }

  const authorization = await db.collection('appConfig').doc(configId).get();
  if (!authorization.exists) {
    throw new HttpsError('failed-precondition', `${roleLabel} signup is not configured.`);
  }
  const config = authorization.data();
  if (
    typeof config.passkeySalt !== 'string' ||
    typeof config.passkeyHash !== 'string' ||
    config.scryptN !== 16384 ||
    config.scryptR !== 8 ||
    config.scryptP !== 1
  ) {
    throw new HttpsError('failed-precondition', `${roleLabel} signup is not configured correctly.`);
  }

  const source = request.rawRequest?.ip || 'unavailable';
  const rateLimitId = createHash('sha256').update(source).digest('hex');
  const rateLimitRef = db.collection(attemptsCollection).doc(rateLimitId);
  const priorAttempts = await rateLimitRef.get();
  const prior = priorAttempts.data();
  const windowStartedAt = prior?.windowStartedAt?.toMillis?.() ?? 0;
  if (prior && windowStartedAt + 15 * 60 * 1000 > Date.now() && prior.count >= 5) {
    throw new HttpsError('resource-exhausted', `Too many ${roleLabel} passkey attempts. Try again later.`);
  }

  const actual = scryptSync(passkey, Buffer.from(config.passkeySalt, 'base64url'), 64, {
    N: config.scryptN,
    r: config.scryptR,
    p: config.scryptP
  });
  const expected = Buffer.from(config.passkeyHash, 'base64url');
  const verified = expected.length === actual.length && timingSafeEqual(actual, expected);
  if (!verified) {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(rateLimitRef);
      const currentData = current.data();
      const currentWindow = currentData?.windowStartedAt?.toMillis?.() ?? 0;
      const withinWindow = current.exists && currentWindow + 15 * 60 * 1000 > Date.now();
      transaction.set(rateLimitRef, {
        count: withinWindow ? (currentData.count ?? 0) + 1 : 1,
        windowStartedAt: withinWindow ? currentData.windowStartedAt : FieldValue.serverTimestamp()
      });
    });
    throw new HttpsError('permission-denied', `${roleLabel} authorization could not be verified.`);
  }
  await rateLimitRef.delete();
}

export const prepareDevAdminRegistration = onCall(async (request) => {
  const email = text(request.data?.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  const passkey = request.data?.passkey;
  await verifyAuthorizationPasskey(
    request,
    passkey,
    'devAuthorization',
    'devAuthorizationAttempts',
    'Dev Admin'
  );

  try {
    await auth.getUserByEmail(email);
    throw new HttpsError('already-exists', 'An account already exists for this email.');
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  const profile = await db.collection('userProfiles').where('email', '==', email).limit(1).get();
  if (!profile.empty) {
    throw new HttpsError('already-exists', 'An account already exists for this email.');
  }

  const ticket = randomBytes(32).toString('base64url');
  const ticketId = createHash('sha256').update(ticket).digest('hex');
  await db.collection('devAdminRegistrationTickets').doc(ticketId).create({
    email,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp()
  });
  return { registrationTicket: ticket };
});

export const prepareAcademicRegistration = onCall(async (request) => {
  const email = text(request.data?.email, 'Email', 254).toLowerCase();
  const fullName = text(request.data?.fullName, 'Full name', 120);
  const role = request.data?.role;
  const department = text(request.data?.department, 'Department', 120);
  const faculty = text(request.data?.faculty, 'Faculty', 120);
  const studentId = text(request.data?.studentId, role === 'student' ? 'Registration number' : 'Staff ID', 64);
  const level = role === 'student' ? text(request.data?.level, 'Level', 20) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['student', 'lecturer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Email or signup role is invalid.');
  }
  await verifyAuthorizationPasskey(
    request,
    request.data?.passkey,
    'registrationAuthorization',
    'registrationAuthorizationAttempts',
    'Student and Lecturer'
  );

  try {
    await auth.getUserByEmail(email);
    throw new HttpsError('already-exists', 'An account already exists for this email.');
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  const existingProfile = await db.collection('userProfiles').where('email', '==', email).limit(1).get();
  if (!existingProfile.empty) {
    throw new HttpsError('already-exists', 'An account already exists for this email.');
  }

  const ticket = randomBytes(32).toString('base64url');
  const ticketId = createHash('sha256').update(ticket).digest('hex');
  await db.collection('academicRegistrationTickets').doc(ticketId).create({
    email,
    role,
    fullName,
    department,
    faculty,
    studentId: studentId.trim().toUpperCase(),
    level,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp()
  });
  return { registrationTicket: ticket };
});

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  const boundedA = Math.min(1, Math.max(0, a));
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

function validCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function toStudentDetail(uid, profile) {
  return {
    id: uid,
    role: profile.role,
    fullName: profile.fullName,
    studentId: profile.studentId,
    department: profile.department,
    faculty: profile.faculty,
    level: profile.level,
    email: profile.email,
    avatar: 'assets/uniuyo-logo.png',
    semester: profile.semester,
    academicSession: profile.academicSession,
    attendanceRate: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    status: 'Good Standing',
    enrolledCourses: []
  };
}

export const completeDevAdminRegistration = onCall(async (request) => {
  const user = requireUser(request);
  const email = text(user.token.email, 'Authenticated email', 254).toLowerCase();
  const fullName = text(request.data?.fullName, 'Full name', 120);
  const ticket = text(request.data?.registrationTicket, 'Registration ticket', 128);
  const ticketRef = db.collection('devAdminRegistrationTickets')
    .doc(createHash('sha256').update(ticket).digest('hex'));
  const profileRef = db.collection('userProfiles').doc(user.uid);
  if (user.token.role) {
    throw new HttpsError('permission-denied', 'This account already has an assigned role.');
  }

  const profile = {
    id: user.uid,
    uid: user.uid,
    fullName,
    email,
    role: 'dev_admin',
    department: '',
    faculty: '',
    level: '',
    active: true,
    authenticationMethod: 'password_with_dev_passkey',
    createdAt: new Date().toISOString()
  };
  const auditId = `audit_${randomUUID()}`;
  const auditRef = db.collection('auditLog').doc(auditId);
  await db.runTransaction(async (transaction) => {
    const [currentProfile, currentTicket] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(ticketRef)
    ]);
    if (currentProfile.exists) {
      throw new HttpsError('already-exists', 'This account is already registered.');
    }
    if (
      !currentTicket.exists ||
      currentTicket.data().email !== email ||
      currentTicket.data().expiresAt.toMillis() <= Date.now()
    ) {
      throw new HttpsError('permission-denied', 'Dev Admin authorization could not be verified. Start signup again.');
    }
    transaction.create(profileRef, profile);
    transaction.delete(ticketRef);
    transaction.create(auditRef, {
      id: auditId,
      timestamp: profile.createdAt,
      actorId: user.uid,
      actorName: fullName,
      actorRole: 'dev_admin',
      action: 'dev_admin.registered',
      targetType: 'account',
      targetId: user.uid,
      details: 'New Dev Admin registration authorized by the server-side passkey.'
    });
  });
  try {
    await auth.setCustomUserClaims(user.uid, {
      role: 'dev_admin',
      department: '',
      faculty: '',
      level: ''
    });
  } catch (error) {
    await db.runTransaction(async (transaction) => {
      const [currentProfile, currentAudit] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(auditRef)
      ]);
      if (currentProfile.exists && currentProfile.data().role === 'dev_admin') {
        transaction.delete(profileRef);
      }
      if (currentAudit.exists) {
        transaction.delete(auditRef);
      }
    });
    throw error;
  }
  return { success: true };
});

export const completeRegistration = onCall(async (request) => {
  const user = requireUser(request);
  const email = text(user.token.email, 'Authenticated email').toLowerCase();
  const registrationTicket = text(request.data?.registrationTicket, 'Registration ticket', 128);
  const ticketRef = db.collection('academicRegistrationTickets')
    .doc(createHash('sha256').update(registrationTicket).digest('hex'));
  const profileRef = db.collection('userProfiles').doc(user.uid);
  const studentRef = db.collection('students').doc(user.uid);

  const result = await db.runTransaction(async (transaction) => {
    const [ticketSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(ticketRef),
      transaction.get(profileRef)
    ]);
    if (!ticketSnapshot.exists || profileSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Registration authorization is invalid, expired, or already used.');
    }

    const registration = ticketSnapshot.data();
    if (
      registration.email !== email ||
      !registration.expiresAt ||
      typeof registration.expiresAt.toMillis !== 'function' ||
      registration.expiresAt.toMillis() <= Date.now() ||
      !['student', 'lecturer'].includes(registration.role) ||
      typeof registration.department !== 'string' ||
      !registration.department.trim() ||
      typeof registration.faculty !== 'string' ||
      !registration.faculty.trim() ||
      typeof registration.studentId !== 'string' ||
      !registration.studentId.trim() ||
      (registration.role === 'student' &&
        (typeof registration.level !== 'string' || !registration.level.trim()))
    ) {
      throw new HttpsError('permission-denied', 'Registration authorization is invalid, expired, or assigned to a different email.');
    }

    const profile = {
      id: user.uid,
      uid: user.uid,
      fullName: registration.fullName,
      email,
      role: registration.role,
      studentId: registration.studentId.trim().toUpperCase(),
      department: registration.department.trim(),
      faculty: registration.faculty.trim(),
      level: registration.level?.trim() || '',
      active: true,
      createdAt: new Date().toISOString()
    };
    transaction.create(profileRef, profile);
    transaction.delete(ticketRef);
    if (registration.role === 'student') {
      transaction.create(studentRef, toStudentDetail(user.uid, profile));
    }
    return { role: profile.role, department: profile.department };
  });

  await auth.setCustomUserClaims(user.uid, result);
  return { success: true };
});

export const updateUserProfile = onCall(async (request) => {
  const user = requireUser(request);
  if (!user.token.email_verified) {
    throw new HttpsError('permission-denied', 'Verify your email before updating your profile.');
  }
  const profileRef = db.collection('userProfiles').doc(user.uid);
  const profileSnapshot = await profileRef.get();
  if (!profileSnapshot.exists || !user.token.role) {
    throw new HttpsError('permission-denied', 'The account profile is not authorized.');
  }
  const current = profileSnapshot.data();
  if (current.role !== user.token.role || current.department !== user.token.department) {
    throw new HttpsError('permission-denied', 'The account authorization is out of date.');
  }

  const profile = {
    ...current,
    fullName: text(request.data?.fullName, 'Full name', 120)
  };
  const semester = request.data?.semester;
  const academicSession = request.data?.academicSession;
  if (semester !== 'First Semester' && semester !== 'Second Semester') {
    throw new HttpsError('invalid-argument', 'Choose a valid semester.');
  }
  const academicSessionMatch = typeof academicSession === 'string'
    ? academicSession.match(/^(\d{4})\/(\d{4})$/)
    : null;
  if (
    !academicSessionMatch ||
    Number(academicSessionMatch[2]) !== Number(academicSessionMatch[1]) + 1
  ) {
    throw new HttpsError('invalid-argument', 'Enter the academic session in YYYY/YYYY format.');
  }
  profile.semester = semester;
  profile.academicSession = academicSession;
  await profileRef.update({
    fullName: profile.fullName,
    semester,
    academicSession
  });
  if (profile.role !== 'lecturer') {
    await db.collection('students').doc(user.uid).set({
      id: user.uid,
      role: profile.role,
      fullName: profile.fullName,
      studentId: profile.studentId,
      department: profile.department,
      faculty: profile.faculty,
      level: profile.level,
      email: profile.email,
      semester,
      academicSession
    }, { merge: true });
  }
  return profile;
});

export const saveSemesterAcademicData = onCall(async (request) => {
  const actor = await requireStaff(request);
  const semesterId = documentId(request.data?.semesterId, 'Semester ID');
  const semesterName = text(request.data?.semesterName, 'Semester name', 40);
  const termMatch = semesterName.match(/^(First|Second) Semester (\d{4})\/(\d{4})$/);
  if (!termMatch || Number(termMatch[3]) !== Number(termMatch[2]) + 1) {
    throw new HttpsError('invalid-argument', 'The academic semester is invalid.');
  }

  const hasCourses = request.data?.courses !== undefined;
  const hasTimetable = request.data?.timetable !== undefined;
  const courses = hasCourses ? request.data.courses : [];
  const timetable = hasTimetable ? request.data.timetable : [];
  if (
    (!hasCourses && !hasTimetable) ||
    !Array.isArray(courses) ||
    !Array.isArray(timetable) ||
    courses.length + timetable.length > 450
  ) {
    throw new HttpsError('invalid-argument', 'The semester data is too large or invalid.');
  }

  const safeCourses = courses.map((course) => ({
    id: documentId(course?.id, 'Course ID'),
    semesterId,
    semesterName,
    code: text(course?.code, 'Course code', 32),
    title: text(course?.title, 'Course title', 160),
    department: actor.department,
    faculty: actor.profile.faculty ?? '',
    level: text(course?.level, 'Course level', 40),
    repId: typeof course?.repId === 'string' ? course.repId.trim() : '',
    repName: typeof course?.repName === 'string' ? course.repName.trim().slice(0, 120) : '',
    scheduleDay: typeof course?.scheduleDay === 'string' ? course.scheduleDay.trim().slice(0, 40) : '',
    scheduleTime: typeof course?.scheduleTime === 'string' ? course.scheduleTime.trim().slice(0, 60) : '',
    classroom: typeof course?.classroom === 'string' ? course.classroom.trim().slice(0, 120) : '',
    enrolledStudentCount: Number.isInteger(course?.enrolledStudentCount) && course.enrolledStudentCount >= 0
      ? course.enrolledStudentCount
      : 0
  }));
  const safeTimetable = timetable.map((entry) => {
    if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(entry?.day)) {
      throw new HttpsError('invalid-argument', 'A timetable day is invalid.');
    }
    return {
      id: documentId(entry?.id, 'Timetable entry ID'),
      semesterId,
      semesterName,
      department: actor.department,
      level: text(entry?.level, 'Timetable level', 40),
      day: entry.day,
      time: text(entry?.time, 'Timetable time', 60),
      endTime: typeof entry?.endTime === 'string' ? entry.endTime.trim().slice(0, 60) : '',
      courseCode: text(entry?.courseCode, 'Timetable course code', 32),
      courseTitle: text(entry?.courseTitle, 'Timetable course title', 160),
      location: typeof entry?.location === 'string' ? entry.location.trim().slice(0, 120) : '',
      isCancelled: entry?.isCancelled === true
    };
  });

  if (
    new Set(safeCourses.map((course) => course.id)).size !== safeCourses.length ||
    new Set(safeTimetable.map((entry) => entry.id)).size !== safeTimetable.length
  ) {
    throw new HttpsError('invalid-argument', 'Semester data contains duplicate entry IDs.');
  }

  const repIds = [...new Set(safeCourses.map((course) => course.repId).filter(Boolean))];
  const repProfiles = await Promise.all(repIds.map((uid) => db.collection('userProfiles').doc(uid).get()));
  if (repProfiles.some((profile) =>
    !profile.exists ||
    profile.data().department !== actor.department ||
    !['student', 'course_rep_admin', 'assistant_course_rep'].includes(profile.data().role)
  )) {
    throw new HttpsError('invalid-argument', 'A course representative must be an eligible account in this department.');
  }
  for (const course of safeCourses) {
    if (!course.repId) course.repName = '';
    else course.repName = repProfiles[repIds.indexOf(course.repId)].data().fullName;
  }

  const [existingCourses, existingTimetable] = await Promise.all([
    hasCourses ? db.collection('courses').where('department', '==', actor.department).get() : null,
    hasTimetable ? db.collection('timetable').where('department', '==', actor.department).get() : null
  ]);
  const courseIds = new Set(safeCourses.map((course) => course.id));
  const timetableIds = new Set(safeTimetable.map((entry) => entry.id));
  const staleCourses = existingCourses?.docs.filter((document) =>
    document.data().semesterId === semesterId && !courseIds.has(document.id)
  ) ?? [];
  const staleTimetable = existingTimetable?.docs.filter((document) =>
    document.data().semesterId === semesterId && !timetableIds.has(document.id)
  ) ?? [];
  if (
    staleCourses.length + staleTimetable.length + safeCourses.length + safeTimetable.length > 450
  ) {
    throw new HttpsError('resource-exhausted', 'This semester table is too large to replace in one operation.');
  }

  const batch = db.batch();
  staleCourses.forEach((document) => batch.delete(document.ref));
  staleTimetable.forEach((document) => batch.delete(document.ref));
  safeCourses.forEach((course) => batch.set(db.collection('courses').doc(course.id), course));
  safeTimetable.forEach((entry) => batch.set(db.collection('timetable').doc(entry.id), entry));
  await batch.commit();
  return {
    success: true,
    ...(hasCourses ? { courses: safeCourses } : {}),
    ...(hasTimetable ? { timetable: safeTimetable } : {})
  };
});

export const assignCourseRepRole = onCall(async (request) => {
  const actor = await requireStaff(request, ['lecturer']);
  const targetUid = documentId(request.data?.studentUid, 'Student account ID');
  const role = request.data?.role;
  if (!['student', 'course_rep_admin', 'assistant_course_rep'].includes(role)) {
    throw new HttpsError('invalid-argument', 'The requested role is invalid.');
  }

  const profileRef = db.collection('userProfiles').doc(targetUid);
  const studentRef = db.collection('students').doc(targetUid);
  const profile = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Student account was not found.');
    const target = snapshot.data();
    if (
      target.role === 'lecturer' ||
      !allowedStudentRoles.includes(target.role) ||
      target.department !== actor.department ||
      targetUid === actor.uid
    ) {
      throw new HttpsError('permission-denied', 'You cannot assign a role to this account.');
    }
    transaction.update(profileRef, { role });
    transaction.set(studentRef, { role }, { merge: true });
    return { ...target, role };
  });

  const targetAuth = await auth.getUser(targetUid);
  await auth.setCustomUserClaims(targetUid, {
    ...targetAuth.customClaims,
    role,
    department: profile.department
  });
  return { success: true };
});

export const createAttendanceSession = onCall(async (request) => {
  const actor = await requireStaff(request);
  const configSnapshot = await db.collection('appConfig').doc('devSettings').get();
  const config = configSnapshot.exists ? configSnapshot.data() : {};
  const maxGpsAccuracyMeters = config.maxGpsAccuracyMeters ?? 50;
  const minRadiusMeters = config.minRadiusMeters ?? 10;
  const pinLength = config.pinLength ?? 6;
  const effectiveLateThreshold = config.lateThresholdMinutes ?? request.data?.lateThresholdMinutes;
  const courseId = documentId(request.data?.courseId, 'Course');
  const locationName = text(request.data?.locationName, 'Location', 120);
  const {
    latitude,
    longitude,
    locationAccuracyMeters,
    radiusMeters,
    durationMinutes,
    lateThresholdMinutes
  } = request.data ?? {};
  if (
    !validCoordinate(latitude, -90, 90) ||
    !validCoordinate(longitude, -180, 180) ||
    !Number.isFinite(locationAccuracyMeters) ||
    locationAccuracyMeters < 0 ||
    locationAccuracyMeters > maxGpsAccuracyMeters
  ) {
    throw new HttpsError('invalid-argument', 'Class location coordinates and GPS accuracy are invalid.');
  }
  if (!Number.isInteger(radiusMeters) || radiusMeters < minRadiusMeters || radiusMeters > 500) {
    throw new HttpsError('invalid-argument', 'Geofence radius is invalid.');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
    throw new HttpsError('invalid-argument', 'Attendance duration is invalid.');
  }
  if (
    !Number.isInteger(effectiveLateThreshold) ||
    effectiveLateThreshold < 0 ||
    effectiveLateThreshold > durationMinutes
  ) {
    throw new HttpsError('invalid-argument', 'Late threshold is invalid.');
  }

  const [courseSnapshot, profileSnapshot] = await Promise.all([
    db.collection('courses').doc(courseId).get(),
    db.collection('userProfiles').doc(actor.uid).get()
  ]);
  if (!courseSnapshot.exists || !profileSnapshot.exists) {
    throw new HttpsError('not-found', 'Course or staff profile was not found.');
  }
  const course = courseSnapshot.data();
  const profile = profileSnapshot.data();
  const semesterName = text(course.semesterName, 'Course semester', 40);
  const submittedSemesterName = text(request.data?.semesterName, 'Course semester', 40);
  const termMatch = semesterName.match(/^(First|Second) Semester (\d{4})\/(\d{4})$/);
  if (
    !termMatch ||
    Number(termMatch[3]) !== Number(termMatch[2]) + 1 ||
    submittedSemesterName.toLowerCase() !== semesterName.toLowerCase()
  ) {
    throw new HttpsError('failed-precondition', 'This course does not have a valid matching academic semester.');
  }
  if (course.department !== actor.department || profile.role !== actor.role) {
    throw new HttpsError('permission-denied', 'You cannot open a session for this course.');
  }
  if (actor.role !== 'lecturer' && course.repId !== actor.uid) {
    throw new HttpsError('permission-denied', 'You are not assigned to broadcast attendance for this course.');
  }

  const start = new Date();
  const sessionId = `sess_${randomUUID()}`;
  const session = {
    id: sessionId,
    courseId,
    courseCode: course.code,
    courseTitle: course.title,
    semesterId: course.semesterId || '',
    semesterName,
    courseLevel: course.level,
    department: course.department,
    faculty: course.faculty ?? actor.profile.faculty ?? '',
    locationName,
    latitude,
    longitude,
    radiusMeters,
    pinLength,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + durationMinutes * 60000).toISOString(),
    lateThresholdMinutes: effectiveLateThreshold,
    status: 'active',
    maxStudents: course.enrolledStudentCount || 0,
    totalAttendees: 0,
    lecturerName: profile.fullName,
    lecturerId: actor.uid,
    createdAt: start.toISOString()
  };
  const accessCode = String(randomInt(10 ** (pinLength - 1), 10 ** pinLength));
  const batch = db.batch();
  batch.create(db.collection('sessions').doc(sessionId), session);
  batch.create(db.collection('sessionSecrets').doc(sessionId), {
    accessCode,
    department: course.department,
    createdBy: actor.uid
  });
  batch.create(db.collection('notifications').doc(`open_${sessionId}`), {
    id: `open_${sessionId}`,
    type: 'session_opened',
    title: 'New Attendance Broadcast',
    body: `${profile.fullName} opened live GPS attendance for ${course.code} at ${locationName}.`,
    timestamp: start.toISOString(),
    read: false,
    courseCode: course.code,
    sessionId,
    department: course.department
  });
  await batch.commit();
  await writeAudit(
    { ...actor, profile },
    'session.created',
    'session',
    sessionId,
    `${course.code} opened at ${locationName}`
  );
  return { session: { ...session, accessCode } };
});

export const getSessionAccessCodes = onCall(async (request) => {
  const actor = await requireStaff(request);
  const sessions = await db.collection('sessions').where('department', '==', actor.department).get();
  const now = Date.now();
  const activeSessions = sessions.docs.filter((document) =>
    document.data().status === 'active' &&
    Date.parse(document.data().endTime) > now
  );
  const secrets = await Promise.all(activeSessions.map((session) =>
    db.collection('sessionSecrets').doc(session.id).get()
  ));
  return Object.fromEntries(
    secrets.filter((secret) => secret.exists).map((secret) => [secret.id, secret.data().accessCode])
  );
});

export const closeAttendanceSession = onCall(async (request) => {
  const actor = await requireStaff(request);
  const sessionId = documentId(request.data?.sessionId, 'Session ID');
  const sessionRef = db.collection('sessions').doc(sessionId);
  const secretRef = db.collection('sessionSecrets').doc(sessionId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Attendance session was not found.');
    const session = snapshot.data();
    if (session.department !== actor.department || session.status !== 'active') {
      throw new HttpsError('permission-denied', 'You cannot close this attendance session.');
    }
    transaction.update(sessionRef, { status: 'closed', endTime: new Date().toISOString() });
    transaction.delete(secretRef);
  });
  const profile = await db.collection('userProfiles').doc(actor.uid).get();
  await writeAudit({ ...actor, profile: profile.data() }, 'session.closed', 'session', sessionId, 'Session closed by authorized host.');
  return { success: true };
});

export const submitAttendanceCheckIn = onCall(async (request) => {
  const user = requireUser(request);
  const role = user.token.role;
  const actorProfileSnapshot = await db.collection('userProfiles').doc(user.uid).get();
  if (!['student', 'course_rep_admin', 'assistant_course_rep', 'rep_admin'].includes(role)) {
    throw new HttpsError('permission-denied', 'This account cannot submit attendance.');
  }
  if (!actorProfileSnapshot.exists || actorProfileSnapshot.data().active === false) {
    throw new HttpsError('permission-denied', 'This account is deactivated.');
  }
  if (!user.token.email_verified) {
    throw new HttpsError('permission-denied', 'Verify your email before checking in.');
  }

  const sessionId = documentId(request.data?.sessionId, 'Session ID');
  const accessCode = text(request.data?.accessCode, 'Verification code', 12);
  const { latitude, longitude, accuracy } = request.data ?? {};
  const geofenceConfig = await db.collection('appConfig').doc('devSettings').get();
  const maxGpsAccuracyMeters = geofenceConfig.exists
    ? geofenceConfig.data().maxGpsAccuracyMeters ?? 50
    : 50;
  if (
    !validCoordinate(latitude, -90, 90) ||
    !validCoordinate(longitude, -180, 180) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > maxGpsAccuracyMeters
  ) {
    throw new HttpsError('invalid-argument', 'Location must have valid coordinates and accuracy within 50 meters.');
  }

  const sessionRef = db.collection('sessions').doc(sessionId);
  const secretRef = db.collection('sessionSecrets').doc(sessionId);
  const profileRef = db.collection('userProfiles').doc(user.uid);
  const recordRef = db.collection('records').doc(`${sessionId}_${user.uid}`);
  const attemptRef = db.collection('sessionCodeAttempts').doc(`${sessionId}_${user.uid}`);
  const notificationId = `record_${recordRef.id}`;
  const notificationRef = db.collection('notifications').doc(notificationId);
  const result = await db.runTransaction(async (transaction) => {
    const [sessionSnapshot, secretSnapshot, profileSnapshot, recordSnapshot, attemptSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(secretRef),
      transaction.get(profileRef),
      transaction.get(recordRef),
      transaction.get(attemptRef)
    ]);
    if (!sessionSnapshot.exists || !secretSnapshot.exists || !profileSnapshot.exists) {
      throw new HttpsError('not-found', 'Session or student profile was not found.');
    }
    if (recordSnapshot.exists) {
      throw new HttpsError('already-exists', 'Attendance has already been recorded for this session.');
    }

    const session = sessionSnapshot.data();
    const secret = secretSnapshot.data();
    const profile = profileSnapshot.data();
    const now = Date.now();
    const startTime = Date.parse(session.startTime);
    const endTime = Date.parse(session.endTime);
    const distance = distanceMeters(latitude, longitude, session.latitude, session.longitude);
    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime < startTime ||
      !Number.isFinite(session.radiusMeters)
    ) {
      throw new HttpsError('failed-precondition', 'The attendance session has invalid settings.');
    }
    const attempt = attemptSnapshot.exists ? attemptSnapshot.data() : {};
    if (Number(attempt.lockedUntil) > now) {
      throw new HttpsError('resource-exhausted', 'Too many incorrect codes. Wait ten minutes before trying again.');
    }
    if (session.department !== user.token.department || secret.department !== user.token.department) {
      throw new HttpsError('permission-denied', 'This attendance session belongs to a different department.');
    }
    if (session.status === 'closed') {
      throw new HttpsError('failed-precondition', 'This attendance session is closed.');
    }
    if (now < startTime) {
      throw new HttpsError('failed-precondition', 'This attendance session has not started yet.');
    }
    if (session.status !== 'active') {
      throw new HttpsError('failed-precondition', 'This attendance session is not open for check-in.');
    }
    if (now > endTime) {
      throw new HttpsError('deadline-exceeded', 'This attendance session has expired.');
    }
    if (profile.role !== role || profile.department !== user.token.department || profile.active === false) {
      throw new HttpsError('permission-denied', 'Your account is not active for this department.');
    }
    if (role === 'student' && (
      profile.level !== session.courseLevel ||
      !profile.semester ||
      typeof session.semesterName !== 'string' ||
      `${profile.semester} ${profile.academicSession}`.toLowerCase() !== session.semesterName.toLowerCase()
    )) {
      throw new HttpsError('permission-denied', 'Your level or semester does not match this session.');
    }
    if (!Number.isFinite(distance)) {
      throw new HttpsError('invalid-argument', 'The GPS distance could not be calculated.');
    }
    if (distance > session.radiusMeters) {
      throw new HttpsError('permission-denied', 'Your location is outside the attendance geofence.');
    }

    if (secret.accessCode !== accessCode.trim()) {
      const withinWindow = Number(attempt.windowStartedAt) > now - 10 * 60 * 1000;
      const failedAttempts = withinWindow ? (Number(attempt.failedAttempts) || 0) + 1 : 1;
      const lockedUntil = failedAttempts >= 5 ? now + 10 * 60 * 1000 : 0;
      transaction.set(attemptRef, {
        failedAttempts,
        windowStartedAt: withinWindow ? attempt.windowStartedAt : now,
        lockedUntil,
        updatedAt: new Date(now).toISOString()
      });
      return { invalidCode: true, locked: lockedUntil > now };
    }

    const status = now > startTime + (session.lateThresholdMinutes || 0) * 60000 ? 'late' : 'present';
    const record = {
      id: recordRef.id,
      sessionId,
      courseId: session.courseId,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      department: session.department,
      faculty: session.faculty ?? '',
      semesterId: session.semesterId,
      semesterName: session.semesterName,
      studentId: user.uid,
      studentName: profile.fullName,
      studentRegNo: profile.studentId,
      status,
      latitude,
      longitude,
      locationAccuracyMeters: accuracy,
      distanceFromClassMeters: Math.round(distance * 10) / 10,
      submittedAt: new Date(now).toISOString(),
      deviceFingerprint: typeof request.data?.deviceFingerprint === 'string'
        ? request.data.deviceFingerprint.slice(0, 128)
        : '',
      verifiedByServer: true,
      verificationMethod: 'gps_code'
    };
    if (attemptSnapshot.exists) transaction.delete(attemptRef);
    transaction.create(recordRef, record);
    transaction.create(notificationRef, {
      id: notificationId,
      type: 'attendance_confirmed',
      title: 'Attendance Verified',
      body: `Attendance was verified for ${record.courseCode}.`,
      timestamp: record.submittedAt,
      read: false,
      courseCode: record.courseCode,
      sessionId,
      department: record.department
    });
    return { record };
  });
  if ('invalidCode' in result) {
    throw new HttpsError(
      result.locked ? 'resource-exhausted' : 'permission-denied',
      result.locked
        ? 'Too many incorrect codes. Wait ten minutes before trying again.'
        : 'The session, term, verification code, or location does not match.'
    );
  }
  await writeAudit(
    { ...user, role, profile: actorProfileSnapshot.data() },
    'attendance.check_in',
    'attendance_record',
    result.record.id,
    `${result.record.courseCode} check-in: ${result.record.status}`
  );
  return result.record;
});

export const getDevAdminSnapshot = onCall(async (request) => {
  await requireDevAdmin(request);
  const names = [
    'faculties', 'courses', 'timetable', 'sessions', 'records',
    'notifications', 'students', 'userProfiles', 'auditLog', 'integrityAlerts', 'appConfig'
  ];
  const entries = await Promise.all(names.map(async (name) => {
    const snapshot = await db.collection(name).get();
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return [name, name === 'auditLog'
      ? rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 2000)
      : rows];
  }));
  return Object.fromEntries(entries);
});

export const logActivity = onCall(async (request) => {
  const user = requireUser(request);
  if (!user.token.email_verified) {
    throw new HttpsError('permission-denied', 'Verify your email before logging activity.');
  }
  const profileSnapshot = await db.collection('userProfiles').doc(user.uid).get();
  if (
    !profileSnapshot.exists ||
    profileSnapshot.data().role !== user.token.role ||
    profileSnapshot.data().active === false
  ) {
    throw new HttpsError('permission-denied', 'Your account is not active.');
  }
  const action = text(request.data?.action, 'Activity action', 80);
  const targetType = text(request.data?.targetType ?? 'account', 'Target type', 80);
  const targetId = text(request.data?.targetId ?? user.uid, 'Target ID', 128);
  const details = text(request.data?.details ?? action, 'Activity details', 500);
  if (!['auth.sign_in', 'auth.sign_out', 'profile.updated', 'attendance.check_in_rejected'].includes(action)) {
    throw new HttpsError('permission-denied', 'This activity type cannot be submitted by a client.');
  }
  if (
    ['auth.sign_in', 'auth.sign_out', 'profile.updated'].includes(action) &&
    targetId !== user.uid
  ) {
    throw new HttpsError('permission-denied', 'You can only log activity for your own account.');
  }
  if (action === 'attendance.check_in_rejected') {
    const session = await db.collection('sessions').doc(targetId).get();
    if (!session.exists || session.data().department !== profileSnapshot.data().department) {
      throw new HttpsError('permission-denied', 'You can only log a rejected check-in for a session in your department.');
    }
  }
  return writeAudit(
    { ...user, profile: profileSnapshot.data() },
    action,
    targetType,
    targetId,
    details
  );
});

export const devAdminAction = onCall(async (request) => {
  const actor = await requireDevAdmin(request);
  const action = text(request.data?.action, 'Action', 40);
  const targetId = documentId(request.data?.targetId, 'Target ID');
  const reason = text(request.data?.reason, 'Written reason', 500);
  if (reason.length < 8) {
    throw new HttpsError('invalid-argument', 'The written reason must be at least 8 characters.');
  }

  if (action === 'force_close') {
    const sessionRef = db.collection('sessions').doc(targetId);
    const secretRef = db.collection('sessionSecrets').doc(targetId);
    const snapshot = await sessionRef.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Session was not found.');
    if (snapshot.data().status !== 'active') {
      throw new HttpsError('failed-precondition', 'Only open sessions can be force-closed.');
    }
    await db.runTransaction(async (transaction) => {
      transaction.update(sessionRef, {
        status: 'closed',
        endTime: new Date().toISOString(),
        forceClosedBy: actor.uid,
        forceCloseReason: reason
      });
      transaction.delete(secretRef);
    });
    await writeAudit(actor, 'session.force_closed', 'session', targetId, reason);
    return { success: true };
  }

  if (action === 'record_flag' || action === 'record_void' || action === 'record_annotate') {
    const recordRef = db.collection('records').doc(targetId);
    const record = await recordRef.get();
    if (!record.exists) throw new HttpsError('not-found', 'Attendance record was not found.');
    const update = action === 'record_flag'
      ? { integrityFlag: reason, integrityFlaggedBy: actor.uid, integrityFlaggedAt: new Date().toISOString() }
      : action === 'record_void'
        ? { voidedAt: new Date().toISOString(), voidedBy: actor.uid, voidReason: reason }
        : { annotation: reason, annotatedBy: actor.uid, annotatedAt: new Date().toISOString() };
    await recordRef.update(update);
    await writeAudit(actor, action, 'attendance_record', targetId, reason);
    return { success: true };
  }

  if (action === 'alert_acknowledge' || action === 'alert_resolve') {
    const title = text(request.data?.title, 'Alert title', 160);
    const evidence = text(request.data?.evidence, 'Alert evidence', 500);
    const alertRef = db.collection('integrityAlerts').doc(targetId);
    const settings = await db.collection('appConfig').doc('devSettings').get();
    await alertRef.set({
      id: targetId,
      title,
      evidence,
      status: action === 'alert_resolve' ? 'resolved' : 'acknowledged',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.uid,
      reason,
      isDemoData: settings.exists && settings.data().demoMode === true
    }, { merge: true });
    await writeAudit(actor, action, 'integrity_alert', targetId, reason);
    return { success: true };
  }

  if (action === 'account_deactivate' || action === 'account_reactivate') {
    if (targetId === actor.uid) {
      throw new HttpsError('failed-precondition', 'You cannot deactivate your own dev account.');
    }
    const profileRef = db.collection('userProfiles').doc(targetId);
    const profile = await profileRef.get();
    if (!profile.exists) throw new HttpsError('not-found', 'Account was not found.');
    const active = action === 'account_reactivate';
    await auth.updateUser(targetId, { disabled: !active });
    await profileRef.update({ active });
    await writeAudit(actor, action, 'account', targetId, reason);
    return { success: true };
  }

  if (action === 'broadcast') {
    const broadcastSettings = await db.collection('appConfig').doc('devSettings').get();
    if (broadcastSettings.exists && broadcastSettings.data().featureFlags?.managementBroadcasts === false) {
      throw new HttpsError('failed-precondition', 'Management broadcasts are disabled in system settings.');
    }
    const scope = request.data?.scope;
    const scopeValue = typeof request.data?.scopeValue === 'string' ? request.data.scopeValue.trim() : '';
    if (!['everyone', 'faculty', 'department', 'level'].includes(scope)) {
      throw new HttpsError('invalid-argument', 'Choose a valid announcement audience.');
    }
    if (scope !== 'everyone' && !scopeValue) {
      throw new HttpsError('invalid-argument', 'Choose an audience value.');
    }
    const title = text(request.data?.title, 'Announcement title', 120);
    const body = text(request.data?.body, 'Announcement message', 1000);
    const profiles = await db.collection('userProfiles').get();
    const recipients = profiles.docs.filter((item) => {
      const profile = item.data();
      return profile.active !== false && (
        scope === 'everyone' ||
        (scope === 'faculty' && profile.faculty === scopeValue) ||
        (scope === 'department' && profile.department === scopeValue) ||
        (scope === 'level' && profile.level === scopeValue)
      );
    });
    if (recipients.length > 450) {
      throw new HttpsError('resource-exhausted', 'Audience is too large for one broadcast.');
    }
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const profile of recipients) {
      const id = `broadcast_${randomUUID()}`;
      batch.create(db.collection('notifications').doc(id), {
        id, type: 'schedule_change', title, body, timestamp: now, read: false,
        department: profile.data().department ?? '',
        faculty: profile.data().faculty ?? '',
        targetUserId: profile.id,
        isDemoData: broadcastSettings.exists && broadcastSettings.data().demoMode === true
      });
    }
    await batch.commit();
    await writeAudit(actor, 'notification.broadcast', 'notification', scope, `${title}: ${reason}`);
    return { success: true, recipients: recipients.length };
  }

  if (action === 'save_config') {
    const config = request.data?.config;
    const minRadiusMeters = Number(config?.minRadiusMeters);
    const maxGpsAccuracyMeters = Number(config?.maxGpsAccuracyMeters);
    const lateThresholdMinutes = Number(config?.lateThresholdMinutes);
    const pinLength = Number(config?.pinLength);
    if (
      !Number.isInteger(minRadiusMeters) || minRadiusMeters < 10 || minRadiusMeters > 100 ||
      !Number.isInteger(maxGpsAccuracyMeters) || maxGpsAccuracyMeters < 5 || maxGpsAccuracyMeters > 100 ||
      !Number.isInteger(lateThresholdMinutes) || lateThresholdMinutes < 0 || lateThresholdMinutes > 60 ||
      !Number.isInteger(pinLength) || pinLength < 4 || pinLength > 8
    ) {
      throw new HttpsError('invalid-argument', 'One or more system settings are outside allowed limits.');
    }
    const settingsRef = db.collection('appConfig').doc('devSettings');
    const existingSettings = await settingsRef.get();
    const value = {
      id: 'devSettings',
      minRadiusMeters, maxGpsAccuracyMeters, lateThresholdMinutes, pinLength,
      semesterName: text(config?.semesterName, 'Semester', 60),
      featureFlags: {
        anomalyAlerts: config?.featureFlags?.anomalyAlerts === true,
        managementBroadcasts: config?.featureFlags?.managementBroadcasts === true
      },
      demoMode: existingSettings.exists && existingSettings.data().demoMode === true,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.uid
    };
    await settingsRef.set(value);
    await writeAudit(actor, 'system.config_updated', 'configuration', 'devSettings', reason);
    return { success: true, config: value };
  }

  if (action === 'reset_demo') {
    if (request.data?.confirmation !== 'RESET DEMO DATA') {
      throw new HttpsError('failed-precondition', 'Type RESET DEMO DATA exactly to confirm.');
    }
    const configRef = db.collection('appConfig').doc('devSettings');
    const configSnapshot = await configRef.get();
    if (!configSnapshot.exists || configSnapshot.data().demoMode !== true) {
      throw new HttpsError('failed-precondition', 'Demo mode is not enabled for this Firebase project.');
    }
    const names = ['faculties', 'courses', 'timetable', 'sessions', 'records', 'notifications', 'students', 'userProfiles', 'integrityAlerts'];
    let batch = db.batch();
    let count = 0;
    for (const name of names) {
      const snapshot = await db.collection(name).where('isDemoData', '==', true).get();
      for (const item of snapshot.docs) {
        if (name === 'userProfiles' && item.data().demoAuthAccount === true) {
          await auth.deleteUser(item.id).catch((error) => {
            if (error.code !== 'auth/user-not-found') throw error;
          });
        }
        batch.delete(item.ref);
        count += 1;
        if (count % 450 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }
    }
    if (count % 450 !== 0) await batch.commit();
    const secrets = await db.collection('sessionSecrets').where('isDemoData', '==', true).get();
    for (let index = 0; index < secrets.docs.length; index += 450) {
      const secretBatch = db.batch();
      secrets.docs.slice(index, index + 450).forEach((item) => secretBatch.delete(item.ref));
      await secretBatch.commit();
    }
    await writeAudit(actor, 'demo_data.reset', 'demo_data', 'demoData', `${reason} Removed ${count} demo documents.`);
    return { success: true, removed: count };
  }

  throw new HttpsError('invalid-argument', 'Unsupported administrator action.');
});
