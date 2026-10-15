/**
 * App-level data boundary. Replace this module when swapping Firebase for
 * another backend; UI components should not write directly to Firestore.
 * Firebase is currently the cross-device source of truth (browser storage is
 * only per-device and cannot provide institution-wide live monitoring).
 */
export {
  assignStudentCourseRepRole,
  closeAttendanceSession,
  createAttendanceSession,
  firebaseErrorMessage,
  getAttendanceRecords,
  getDevAdminSnapshot,
  getFirebaseUserProfile,
  getSessionAccessCodes,
  logActivity,
  readFirestoreCollection,
  runDevAdminAction,
  saveSemesterAcademicData,
  submitAttendanceCheckIn,
  subscribeFirestoreCollection,
  updateFirebaseUserProfile
} from './firebase';
export type { AttendanceCheckIn, DevAdminSnapshot, NewAttendanceSession } from './firebase';
