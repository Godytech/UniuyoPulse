import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  initializeAuth,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceNotification,
  AuthUser,
  Course,
  CourseRepRole,
  StudentDetail,
  TimetableEntry,
  User
} from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDfQ7p22J0TYA9fAKK9SThJIJ8JYYJf4YQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'uniuyo-pulse.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'uniuyo-pulse',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'uniuyo-pulse.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1098173918522',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1098173918522:web:aeecb342541437142cf403'
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = initializeAuth(app, { persistence: browserSessionPersistence });
const firebaseFunctions = getFunctions(app);

const USER_PROFILES = 'userProfiles';
let firestoreModulePromise: Promise<typeof import('firebase/firestore')> | undefined;

export interface CollectionFilter {
  field: string;
  value: string;
}

export interface SemesterAcademicData {
  semesterId: string;
  semesterName: string;
  courses?: Course[];
  timetable?: TimetableEntry[];
}

export interface NewAttendanceSession {
  courseId: string;
  semesterName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  locationAccuracyMeters: number;
  radiusMeters: number;
  durationMinutes: number;
  lateThresholdMinutes: number;
}

export interface AttendanceCheckIn {
  sessionId: string;
  accessCode: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  deviceFingerprint?: string;
}

export interface DevAdminSnapshot {
  faculties: import('../types').Faculty[];
  courses: Course[];
  timetable: TimetableEntry[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  notifications: AttendanceNotification[];
  students: StudentDetail[];
  userProfiles: User[];
  auditLog: import('../types').AuditLogEntry[];
  integrityAlerts: Array<{ id: string; status: 'acknowledged' | 'resolved'; title: string; evidence: string }>;
  appConfig: Record<string, unknown>[];
}

export async function getDevAdminSnapshot(): Promise<DevAdminSnapshot> {
  const {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore
  } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const collectionNames = [
    'faculties',
    'courses',
    'timetable',
    'sessions',
    'records',
    'notifications',
    'students',
    'userProfiles',
    'auditLog',
    'integrityAlerts'
  ] as const;
  const [snapshots, settingsSnapshot] = await Promise.all([
    Promise.all(collectionNames.map((name) => getDocs(collection(firestore, name)))),
    getDoc(doc(firestore, 'appConfig', 'devSettings'))
  ]);
  const toRows = <T,>(snapshot: (typeof snapshots)[number]): T[] =>
    snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  const auditLog = toRows<DevAdminSnapshot['auditLog'][number]>(snapshots[8])
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 2000);

  return {
    faculties: toRows<DevAdminSnapshot['faculties'][number]>(snapshots[0]),
    courses: toRows<Course>(snapshots[1]),
    timetable: toRows<TimetableEntry>(snapshots[2]),
    sessions: toRows<AttendanceSession>(snapshots[3]),
    records: toRows<AttendanceRecord>(snapshots[4]),
    notifications: toRows<AttendanceNotification>(snapshots[5]),
    students: toRows<StudentDetail>(snapshots[6]),
    userProfiles: toRows<User>(snapshots[7]),
    auditLog,
    integrityAlerts: toRows<DevAdminSnapshot['integrityAlerts'][number]>(snapshots[9]),
    appConfig: settingsSnapshot.exists()
      ? [{ id: settingsSnapshot.id, ...settingsSnapshot.data() }]
      : []
  };
}

export async function runDevAdminAction<T = { success: boolean }>(
  input: {
    action: string;
    targetId: string;
    reason: string;
    [key: string]: unknown;
  }
): Promise<T> {
  const runAction = httpsCallable<typeof input, T>(firebaseFunctions, 'devAdminAction');
  const result = await runAction(input);
  return result.data;
}

export async function logActivity(input: {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
}): Promise<void> {
  const log = httpsCallable<typeof input, void>(firebaseFunctions, 'logActivity');
  await log(input);
}

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super('Verify your email address before signing in.');
    this.name = 'EmailVerificationRequiredError';
  }
}

function loadFirestoreModule(): Promise<typeof import('firebase/firestore')> {
  firestoreModulePromise ??= import('firebase/firestore');
  return firestoreModulePromise;
}

export async function assignStudentCourseRepRole(
  student: StudentDetail,
  role: CourseRepRole | 'student'
): Promise<void> {
  const assign = httpsCallable(firebaseFunctions, 'assignCourseRepRole');
  await assign({ studentUid: student.id, role });
}

export async function getSessionAccessCodes(): Promise<Record<string, string>> {
  const getCodes = httpsCallable<void, Record<string, string>>(firebaseFunctions, 'getSessionAccessCodes');
  const result = await getCodes();
  return result.data;
}

export async function createAttendanceSession(input: NewAttendanceSession): Promise<AttendanceSession> {
  const create = httpsCallable<NewAttendanceSession, { session: AttendanceSession }>(
    firebaseFunctions,
    'createAttendanceSession'
  );
  const result = await create(input);
  return result.data.session;
}

export async function saveSemesterAcademicData(
  data: SemesterAcademicData
): Promise<Pick<SemesterAcademicData, 'courses' | 'timetable'>> {
  const save = httpsCallable<
    SemesterAcademicData,
    { success: boolean; courses?: Course[]; timetable?: TimetableEntry[] }
  >(
    firebaseFunctions,
    'saveSemesterAcademicData'
  );
  const result = await save(data);
  return result.data;
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  const close = httpsCallable(firebaseFunctions, 'closeAttendanceSession');
  await close({ sessionId });
}

export async function submitAttendanceCheckIn(input: AttendanceCheckIn): Promise<AttendanceRecord> {
  const submit = httpsCallable<AttendanceCheckIn, AttendanceRecord>(
    firebaseFunctions,
    'submitAttendanceCheckIn'
  );
  const result = await submit(input);
  return result.data;
}

export async function getAttendanceRecords(
  department: string,
  userId: string,
  isStaff: boolean
): Promise<AttendanceRecord[]> {
  return readFirestoreCollection<AttendanceRecord>(
    'records',
    isStaff
      ? { field: 'department', value: department }
      : { field: 'studentId', value: userId }
  );
}

export async function createFirebaseAccount(
  user: Pick<AuthUser, 'email' | 'fullName'>,
  password: string,
  passkey: string,
  academicDetails: {
    role: 'student' | 'lecturer';
    department: string;
    faculty: string;
    studentId: string;
    level: string;
  }
): Promise<void> {
  const prepareRegistration = httpsCallable<
    {
      email: string;
      fullName: string;
      passkey: string;
      role: 'student' | 'lecturer';
      department: string;
      faculty: string;
      studentId: string;
      level: string;
    },
    { registrationTicket: string }
  >(firebaseFunctions, 'prepareAcademicRegistration');
  const preparation = await prepareRegistration({
    email: user.email.trim().toLowerCase(),
    fullName: user.fullName.trim(),
    passkey,
    ...academicDetails
  });
  const credential = await createUserWithEmailAndPassword(firebaseAuth, user.email, password);
  let registrationStarted = false;
  try {
    await sendEmailVerification(credential.user);
    const completeRegistration = httpsCallable(firebaseFunctions, 'completeRegistration');
    registrationStarted = true;
    await completeRegistration({
      registrationTicket: preparation.data.registrationTicket
    });
    await credential.user.getIdToken(true);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (
      !registrationStarted ||
      [
        'functions/already-exists',
        'functions/failed-precondition',
        'functions/invalid-argument',
        'functions/permission-denied',
        'functions/resource-exhausted',
        'functions/unauthenticated'
      ].includes(code)
    ) {
      await deleteUser(credential.user);
    }
    throw error;
  }
}

export async function createDevAdminAccount(
  user: Pick<AuthUser, 'email' | 'fullName'>,
  password: string,
  passkey: string
): Promise<void> {
  const prepareRegistration = httpsCallable<
    { email: string; passkey: string },
    { registrationTicket: string }
  >(firebaseFunctions, 'prepareDevAdminRegistration');
  const preparation = await prepareRegistration({
    email: user.email.trim().toLowerCase(),
    passkey
  });
  const credential = await createUserWithEmailAndPassword(firebaseAuth, user.email, password);
  let registrationStarted = false;
  try {
    await sendEmailVerification(credential.user);
    const completeRegistration = httpsCallable<
      { fullName: string; registrationTicket: string },
      { success: boolean }
    >(firebaseFunctions, 'completeDevAdminRegistration');
    registrationStarted = true;
    await completeRegistration({
      fullName: user.fullName,
      registrationTicket: preparation.data.registrationTicket
    });
    await credential.user.getIdToken(true);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (
      !registrationStarted ||
      [
        'functions/already-exists',
        'functions/failed-precondition',
        'functions/invalid-argument',
        'functions/permission-denied',
        'functions/resource-exhausted',
        'functions/unauthenticated'
      ].includes(code)
    ) {
      await deleteUser(credential.user);
    }
    throw error;
  }
}

export async function signInFirebaseAccount(identifier: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, identifier.trim(), password);
  if (!credential.user.emailVerified) {
    throw new EmailVerificationRequiredError();
  }

  try {
    await credential.user.getIdToken(true);
    const user = await getFirebaseUserProfile(credential.user.uid);
    return user;
  } catch (error) {
    await signOut(firebaseAuth);
    throw error;
  }
}

export async function resendFirebaseEmailVerification(email: string): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Please sign in with the account that needs email verification, then try again.');
  }
  if (user.emailVerified) {
    return;
  }

  await sendEmailVerification(user);
}

export async function refreshVerifiedFirebaseUser(): Promise<User | null> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('Your verification session has expired. Sign in again to continue.');
  }

  await reload(user);
  if (!user.emailVerified) {
    return null;
  }

  await user.getIdToken(true);
  return getFirebaseUserProfile(user.uid);
}

export async function signOutFirebaseAccount(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function updateFirebaseUserProfile(user: User): Promise<User> {
  const authUser = firebaseAuth.currentUser;
  if (!authUser || authUser.uid !== user.id) {
    throw new Error('You can only update your own account profile.');
  }

  const update = httpsCallable<
    Pick<User, 'fullName' | 'semester' | 'academicSession'>,
    User
  >(firebaseFunctions, 'updateUserProfile');
  const result = await update({
    fullName: user.fullName.trim(),
    semester: user.semester,
    academicSession: user.academicSession
  });
  return result.data;
}

export async function getFirebaseUserProfile(uid: string): Promise<User> {
  const { doc, getDoc, getFirestore } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const profileSnapshot = await getDoc(doc(firestore, USER_PROFILES, uid));
  if (!profileSnapshot.exists()) {
    throw new Error('Your account profile is missing. Contact your administrator.');
  }
  const { uid: _uid, ...user } = profileSnapshot.data();
  const authUser = firebaseAuth.currentUser;
  const token = authUser?.uid === uid ? await authUser.getIdTokenResult() : null;
  if (
    !token ||
    token.claims.role !== user.role ||
    token.claims.department !== user.department ||
    user.active === false
  ) {
    throw new Error('Account permissions are not configured correctly. Contact your administrator.');
  }
  return user as User;
}

export async function readFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  filter?: CollectionFilter
): Promise<T[]> {
  const { collection, getDocs, getFirestore, query, where } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const collectionRef = collection(firestore, collectionName);
  const snapshot = await getDocs(
    filter ? query(collectionRef, where(filter.field, '==', filter.value)) : collectionRef
  );
  return snapshot.docs.map((item) => item.data() as T);
}

export async function subscribeFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError: (error: Error) => void,
  filter?: CollectionFilter
): Promise<() => void> {
  const { collection, getFirestore, onSnapshot, query, where } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const collectionRef = collection(firestore, collectionName);
  return onSnapshot(
    filter ? query(collectionRef, where(filter.field, '==', filter.value)) : collectionRef,
    (snapshot) => onData(snapshot.docs.map((item) => item.data() as T)),
    onError
  );
}

export function firebaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if ('code' in error && error.code === 'auth/api-key-not-valid') {
      return 'Firebase rejected this app’s API key. Set VITE_FIREBASE_API_KEY in .env.local to the current Web API key from Firebase Console → Project settings → General → Your apps, then restart the dev server. Also check that the key is enabled and not restricted from Firebase Authentication.';
    }
    if ('code' in error && error.code === 'auth/unauthorized-domain') {
      return 'This website is not authorized for Firebase Authentication. Add localhost (or your deployed hostname) in Firebase Console → Authentication → Settings → Authorized domains.';
    }
    if ('code' in error && error.code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Sign in instead.';
    }
    if ('code' in error && error.code === 'auth/invalid-credential') {
      return 'Email or password is incorrect.';
    }
    if ('code' in error && error.code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if ('code' in error && error.code === 'permission-denied') {
      return 'Firebase denied access. Check that Firestore is enabled and its security rules allow this account.';
    }
    return error.message;
  }
  return 'An unexpected Firebase error occurred.';
}
