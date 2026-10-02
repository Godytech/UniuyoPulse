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
import type { AuthUser, CourseRepRole, StudentDetail, User } from '../types';
import type { Course, TimetableEntry } from '../types';

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

const USER_PROFILES = 'userProfiles';
const STUDENTS = 'students';
const STUDENT_AUTHORIZATION_CONFIG = 'appConfig/studentAuthorization';
const LECTURER_AUTHORIZATION_CONFIG = 'appConfig/lecturerAuthorization';
let firestoreModulePromise: Promise<typeof import('firebase/firestore')> | undefined;

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

function toStudentDetail(uid: string, user: AuthUser | User): StudentDetail {
  return {
    id: uid,
    role: user.role,
    fullName: user.fullName,
    studentId: user.studentId ?? '',
    department: user.department,
    ...(user.faculty === undefined ? {} : { faculty: user.faculty }),
    level: user.level,
    email: user.email,
    avatar: user.avatar || '/assets/uniuyo-logo.png',
    ...(user.semester === undefined ? {} : { semester: user.semester }),
    ...(user.academicSession === undefined ? {} : { academicSession: user.academicSession }),
    attendanceRate: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    status: 'Good Standing',
    enrolledCourses: []
  };
}

export async function syncStudentDirectoryProfile(uid: string, user: AuthUser | User): Promise<void> {
  if (user.role === 'lecturer') return;

  const { doc, getFirestore, setDoc } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  await setDoc(doc(firestore, STUDENTS, uid), toStudentDetail(uid, user), { merge: true });
}

export async function assignStudentCourseRepRole(
  student: StudentDetail,
  role: CourseRepRole | 'student'
): Promise<void> {
  const { doc, getFirestore, writeBatch } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, USER_PROFILES, student.id), { role });
  batch.set(
    doc(firestore, STUDENTS, student.id),
    { ...student, role },
    { merge: true }
  );
  await batch.commit();
}

export async function validateLecturerPasskey(passkey: string): Promise<boolean> {
  return validateAuthorizationPasskey(passkey, LECTURER_AUTHORIZATION_CONFIG, 'Lecturer');
}

export async function validateStudentPasskey(passkey: string): Promise<boolean> {
  return validateAuthorizationPasskey(passkey, STUDENT_AUTHORIZATION_CONFIG, 'Student');
}

async function validateAuthorizationPasskey(
  passkey: string,
  documentPath: string,
  roleName: string
): Promise<boolean> {
  const { doc, getDoc, getFirestore } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const configSnapshot = await getDoc(doc(firestore, documentPath));
  if (!configSnapshot.exists()) {
    throw new Error(`${roleName} passkey is not configured in Firebase. Create ${documentPath} with a string passkey field.`);
  }

  const configuredPasskey = configSnapshot.data().passkey;
  if (typeof configuredPasskey !== 'string' || configuredPasskey.length === 0) {
    throw new Error(`${roleName} passkey configuration in Firebase is invalid.`);
  }

  return configuredPasskey === passkey.trim();
}

export async function createFirebaseAccount(user: AuthUser, password: string): Promise<void> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, user.email, password);
  try {
    await sendEmailVerification(credential.user);
    const { doc, getFirestore, writeBatch } = await loadFirestoreModule();
    const firestore = getFirestore(app);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, USER_PROFILES, credential.user.uid), {
      ...user,
      uid: credential.user.uid
    });
    if (user.role === 'student') {
      batch.set(
        doc(firestore, STUDENTS, credential.user.uid),
        toStudentDetail(credential.user.uid, user)
      );
    }
    await batch.commit();
  } catch (error) {
    await deleteUser(credential.user);
    throw error;
  }
}

export async function signInFirebaseAccount(identifier: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, identifier.trim(), password);
  if (!credential.user.emailVerified) {
    throw new EmailVerificationRequiredError();
  }

  try {
    const user = await getFirebaseUserProfile(credential.user.uid);
    await syncStudentDirectoryProfile(credential.user.uid, user);
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

  const profile = await getFirebaseUserProfile(user.uid);
  await syncStudentDirectoryProfile(user.uid, profile);
  return profile;
}

export async function signOutFirebaseAccount(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function updateFirebaseUserProfile(user: User): Promise<void> {
  const authUser = firebaseAuth.currentUser;
  if (
    !authUser ||
    authUser.uid !== user.id ||
    !['student', 'course_rep_admin', 'assistant_course_rep', 'rep_admin'].includes(user.role)
  ) {
    throw new Error('You can only update your own student or course representative profile.');
  }

  const academicSession = user.academicSession?.trim() ?? '';
  if (!/^\d{4}\/\d{4}$/.test(academicSession)) {
    throw new Error('Enter the academic session in YYYY/YYYY format.');
  }
  if (user.semester !== 'First Semester' && user.semester !== 'Second Semester') {
    throw new Error('Choose a valid semester.');
  }

  const { doc, getFirestore, writeBatch } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const batch = writeBatch(firestore);
  const profile = {
    fullName: user.fullName.trim(),
    studentId: user.studentId?.trim().toUpperCase() ?? '',
    department: user.department.trim(),
    faculty: user.faculty?.trim() ?? '',
    level: user.level.trim(),
    semester: user.semester,
    academicSession
  };
  if (
    !profile.fullName ||
    !profile.studentId ||
    !profile.department ||
    !profile.faculty ||
    !profile.level
  ) {
    throw new Error('Complete your name, registration number, faculty, department, and level.');
  }
  batch.update(doc(firestore, USER_PROFILES, user.id), profile);
  batch.set(
    doc(firestore, STUDENTS, user.id),
    { id: user.id, role: user.role, ...profile, email: user.email, avatar: user.avatar || '/assets/uniuyo-logo.png' },
    { merge: true }
  );
  await batch.commit();
}

export async function getFirebaseUserProfile(uid: string): Promise<User> {
  const { doc, getDoc, getFirestore } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const profileSnapshot = await getDoc(doc(firestore, USER_PROFILES, uid));
  if (!profileSnapshot.exists()) {
    throw new Error('Your account profile is missing. Contact your administrator.');
  }
  const { uid: _uid, ...user } = profileSnapshot.data();
  return user as User;
}

export async function readFirestoreCollection<T extends { id: string }>(
  collectionName: string
): Promise<T[]> {
  const { collection, getDocs, getFirestore } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const snapshot = await getDocs(collection(firestore, collectionName));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function subscribeFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const { collection, getFirestore, onSnapshot } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  return onSnapshot(
    collection(firestore, collectionName),
    (snapshot) => onData(snapshot.docs.map((item) => item.data() as T)),
    onError
  );
}

export async function replaceFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  const { collection, doc, getDocs, getFirestore, writeBatch } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const target = collection(firestore, collectionName);
  const existing = await getDocs(target);
  const itemIds = new Set(items.map((item) => item.id));
  const staleDocuments = existing.docs.filter((document) => !itemIds.has(document.id));

  for (let index = 0; index < staleDocuments.length; index += 450) {
    const batch = writeBatch(firestore);
    staleDocuments.slice(index, index + 450).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }

  for (let index = 0; index < items.length; index += 450) {
    const batch = writeBatch(firestore);
    items.slice(index, index + 450).forEach((item) => {
      batch.set(doc(target, item.id), item);
    });
    await batch.commit();
  }
}

export async function replaceSemesterDepartmentData(
  data: {
    semesterId: string;
    semesterName: string;
    courses: Course[];
    timetable: TimetableEntry[];
  },
  department: string
): Promise<void> {
  const { collection, doc, getDocs, getFirestore, writeBatch } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const coursesCollection = collection(firestore, 'courses');
  const timetableCollection = collection(firestore, 'timetable');
  const [existingCourses, existingTimetable] = await Promise.all([
    getDocs(coursesCollection),
    getDocs(timetableCollection)
  ]);
  const isReplaceable = (item: Record<string, unknown>) =>
    item.semesterId === data.semesterId && item.department === department;
  const staleDocuments = [
    ...existingCourses.docs.filter((item) => isReplaceable(item.data())),
    ...existingTimetable.docs.filter((item) => isReplaceable(item.data()))
  ];
  const operationCount = staleDocuments.length + data.courses.length + data.timetable.length;
  if (operationCount > 450) {
    throw new Error('This semester course table is too large to replace safely in one Firestore batch.');
  }

  const batch = writeBatch(firestore);
  staleDocuments.forEach((item) => batch.delete(item.ref));
  data.courses.forEach((course) => batch.set(doc(coursesCollection, course.id), course));
  data.timetable.forEach((entry) => batch.set(doc(timetableCollection, entry.id), entry));
  await batch.commit();
}

export async function replaceSemesterTimetableData(
  semesterId: string,
  entries: TimetableEntry[],
  department: string
): Promise<void> {
  const { collection, doc, getDocs, getFirestore, writeBatch } = await loadFirestoreModule();
  const firestore = getFirestore(app);
  const timetableCollection = collection(firestore, 'timetable');
  const existingEntries = await getDocs(timetableCollection);
  const staleEntries = existingEntries.docs.filter((item) => {
    const data = item.data();
    return data.semesterId === semesterId && data.department === department;
  });
  if (staleEntries.length + entries.length > 450) {
    throw new Error('This semester timetable is too large to replace safely in one Firestore batch.');
  }

  const batch = writeBatch(firestore);
  staleEntries.forEach((item) => batch.delete(item.ref));
  entries.forEach((entry) => batch.set(doc(timetableCollection, entry.id), entry));
  await batch.commit();
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
