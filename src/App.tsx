import React, { lazy, Suspense, useState, useEffect } from 'react';
import {
  User,
  AttendanceSession,
  AttendanceRecord,
  Course,
  TimetableEntry,
  NavTab,
  AttendanceNotification,
  StudentDetail,
  CourseRepRole,
  ThemeMode
} from './types';
import { AuthPage } from './components/AuthPage';
import { soundManager } from './lib/sound';
import { Check } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, signOutFirebaseAccount } from './lib/firebase';
import {
  firebaseErrorMessage,
  closeAttendanceSession,
  createAttendanceSession,
  assignStudentCourseRepRole,
  getAttendanceRecords,
  getFirebaseUserProfile,
  getSessionAccessCodes,
  readFirestoreCollection,
  saveSemesterAcademicData,
  submitAttendanceCheckIn,
  subscribeFirestoreCollection,
  updateFirebaseUserProfile,
  getDevAdminSnapshot,
  logActivity
} from './lib/store';
import type { AttendanceCheckIn, DevAdminSnapshot, NewAttendanceSession } from './lib/store';
import { can, isDevAdmin, isLecturer, isStudent } from './lib/permissions';
const Sidebar = lazy(() => import('./components/Sidebar').then(({ Sidebar }) => ({ default: Sidebar })));
const TopHeader = lazy(() => import('./components/TopHeader').then(({ TopHeader }) => ({ default: TopHeader })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then(({ StudentDashboard }) => ({ default: StudentDashboard })));
const AdminDashboardView = lazy(() => import('./components/AdminDashboardView').then(({ AdminDashboardView }) => ({ default: AdminDashboardView })));
const GPSVerificationModal = lazy(() => import('./components/GPSVerificationModal').then(({ GPSVerificationModal }) => ({ default: GPSVerificationModal })));
const VerificationSlipModal = lazy(() => import('./components/VerificationSlipModal').then(({ VerificationSlipModal }) => ({ default: VerificationSlipModal })));
const CreateSessionModal = lazy(() => import('./components/CreateSessionModal').then(({ CreateSessionModal }) => ({ default: CreateSessionModal })));
const StudentCoursesView = lazy(() => import('./components/StudentCoursesView').then(({ StudentCoursesView }) => ({ default: StudentCoursesView })));
const CourseManagementView = lazy(() => import('./components/CourseManagementView').then(({ CourseManagementView }) => ({ default: CourseManagementView })));
const StudentsView = lazy(() => import('./components/StudentsView').then(({ StudentsView }) => ({ default: StudentsView })));
const SessionsView = lazy(() => import('./components/SessionsView').then(({ SessionsView }) => ({ default: SessionsView })));
const RecordsView = lazy(() => import('./components/RecordsView').then(({ RecordsView }) => ({ default: RecordsView })));
const ReportsView = lazy(() => import('./components/ReportsView').then(({ ReportsView }) => ({ default: ReportsView })));
const CalendarView = lazy(() => import('./components/CalendarView').then(({ CalendarView }) => ({ default: CalendarView })));
const TimetableManagementView = lazy(() => import('./components/TimetableManagementView').then(({ TimetableManagementView }) => ({ default: TimetableManagementView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(({ ProfileView }) => ({ default: ProfileView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(({ SettingsView }) => ({ default: SettingsView })));
const MobileRightDrawer = lazy(() => import('./components/MobileRightDrawer').then(({ MobileRightDrawer }) => ({ default: MobileRightDrawer })));
const DevAdminConsole = lazy(() => import('./components/DevAdminConsole').then(({ DevAdminConsole }) => ({ default: DevAdminConsole })));

function normalizeAcademicValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getStudentTermName(user: User): string | null {
  if (!isStudent(user) || !user.semester || !user.academicSession) return null;
  return `${user.semester} ${user.academicSession}`;
}

function sessionMatchesStudentTerm(session: AttendanceSession, user: User): boolean {
  const termName = getStudentTermName(user);
  return Boolean(termName && session.semesterName &&
    normalizeAcademicValue(session.semesterName) === normalizeAcademicValue(termName));
}

function canManageSemesterData(role: User['role']): boolean {
  return can(role, 'semester.manage');
}

function canCheckInToSession(role: User['role']): boolean {
  return can(role, 'sessions.checkIn');
}

const EMPTY_DEV_SNAPSHOT: DevAdminSnapshot = {
  faculties: [], courses: [], timetable: [], sessions: [], records: [],
  notifications: [], students: [], userProfiles: [], auditLog: [], integrityAlerts: [], appConfig: []
};

export default function App() {
  // Always require authentication when the application is loaded.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('uniuyo_pulse_theme');
    return saved === 'lights_out' ? 'lights_out' : 'light';
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Domain data is loaded from Firestore and starts empty.
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [firebaseDataReadyForUid, setFirebaseDataReadyForUid] = useState<string | null>(null);
  const [devSnapshot, setDevSnapshot] = useState<DevAdminSnapshot>(EMPTY_DEV_SNAPSHOT);
  const [devSnapshotLoading, setDevSnapshotLoading] = useState(false);
  const [devSnapshotError, setDevSnapshotError] = useState<string | null>(null);
  const [devLastUpdated, setDevLastUpdated] = useState<Date | null>(null);

  // Modals & Action Sheets
  const [checkInSession, setCheckInSession] = useState<AttendanceSession | null>(null);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState<boolean>(false);
  const [viewSlipRecord, setViewSlipRecord] = useState<AttendanceRecord | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3000);
  };

  const handleSaveSemesterCourses = async (
    semesterId: string,
    semesterName: string,
    coursesToSave: Course[],
    timetableToSave: TimetableEntry[]
  ) => {
    if (!canManageSemesterData(currentUser.role)) {
      throw new Error('Only lecturers and assigned course representatives can manage semester courses.');
    }
    const departmentKey = normalizeAcademicValue(currentUser.department);
    if (coursesToSave.some((course) => normalizeAcademicValue(course.department) !== departmentKey)) {
      throw new Error('You can manage courses only for your own department.');
    }

    const department = currentUser.department.trim();
    const scopedData = {
      semesterId,
      semesterName,
      courses: coursesToSave.map((course) => ({ ...course, department })),
      timetable: timetableToSave.map((entry) => ({ ...entry, department }))
    };
    const savedData = await saveSemesterAcademicData(scopedData);
    const savedCourses = savedData.courses ?? scopedData.courses;
    const savedTimetable = savedData.timetable ?? scopedData.timetable;
    setCourses((previous) => [
      ...previous.filter((course) =>
        course.semesterId !== scopedData.semesterId ||
        normalizeAcademicValue(course.department) !== departmentKey
      ),
      ...savedCourses
    ]);
    setTimetable((previous) => [
      ...previous.filter((entry) =>
        entry.semesterId !== scopedData.semesterId ||
        normalizeAcademicValue(entry.department ?? '') !== departmentKey
      ),
      ...savedTimetable
    ]);
  };

  const handleSaveSemesterTimetable = async (
    semesterId: string,
    _semesterName: string,
    entries: TimetableEntry[]
  ) => {
    if (!canManageSemesterData(currentUser.role)) {
      throw new Error('Only lecturers and assigned course representatives can manage timetables.');
    }
    const departmentKey = normalizeAcademicValue(currentUser.department);
    if (entries.some((entry) => normalizeAcademicValue(entry.department ?? '') !== departmentKey)) {
      throw new Error('You can manage timetables only for your own department.');
    }
    const scopedEntries = entries.map((entry) => ({
      ...entry,
      department: currentUser.department.trim()
    }));
    const savedData = await saveSemesterAcademicData({
      semesterId,
      semesterName: _semesterName,
      timetable: scopedEntries
    });
    setTimetable((previous) => [
      ...previous.filter((entry) =>
        entry.semesterId !== semesterId ||
        normalizeAcademicValue(entry.department ?? '') !== departmentKey
      ),
      ...(savedData.timetable ?? scopedEntries)
    ]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (!authUser) {
        setCurrentUser(null);
        setPendingVerificationEmail(null);
        return;
      }
      if (!authUser.emailVerified) {
        setCurrentUser(null);
        setPendingVerificationEmail(authUser.email);
        return;
      }
      setPendingVerificationEmail(null);

      getFirebaseUserProfile(authUser.uid)
        .then((user) => {
          if (firebaseAuth.currentUser?.uid !== authUser.uid || !firebaseAuth.currentUser.emailVerified) {
            return;
          }
          if (firebaseAuth.currentUser?.uid === authUser.uid) {
            setCurrentUser(user);
            setActiveTab(isDevAdmin(user) ? 'dev_live_ops' : 'dashboard');
          }
        })
        .catch((error: unknown) => showToast(`Could not restore Firebase account: ${firebaseErrorMessage(error)}`));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const authUser = firebaseAuth.currentUser;
    if (!currentUser || !authUser) {
      setFirebaseDataReadyForUid(null);
      setCourses([]);
      setSessions([]);
      setRecords([]);
      setTimetable([]);
      setNotifications([]);
      setStudents([]);
      setCheckInSession(null);
      setViewSlipRecord(null);
      return;
    }
    if (isDevAdmin(currentUser)) {
      setFirebaseDataReadyForUid(authUser.uid);
      return;
    }

    let isActive = true;
    let coursesLoaded = false;
    let timetableLoaded = false;
    let otherDataLoaded = false;
    let unsubscribeCourses: (() => void) | undefined;
    let unsubscribeTimetable: (() => void) | undefined;
    setFirebaseDataReadyForUid(null);
    const markReadyIfLoaded = () => {
      if (isActive && coursesLoaded && timetableLoaded && otherDataLoaded) {
        setFirebaseDataReadyForUid(authUser.uid);
      }
    };
    Promise.all([
      subscribeFirestoreCollection<Course>(
        'courses',
        (items) => {
          if (!isActive) return;
          setCourses(items);
          coursesLoaded = true;
          markReadyIfLoaded();
        },
        (error) => showToast(`Could not load courses from Firestore: ${firebaseErrorMessage(error)}`),
        { field: 'department', value: currentUser.department }
      ),
      subscribeFirestoreCollection<TimetableEntry>(
        'timetable',
        (items) => {
          if (!isActive) return;
          setTimetable(items);
          timetableLoaded = true;
          markReadyIfLoaded();
        },
        (error) => showToast(`Could not load timetable from Firestore: ${firebaseErrorMessage(error)}`),
        { field: 'department', value: currentUser.department }
      ),
      readFirestoreCollection<AttendanceSession>('sessions', {
        field: 'department',
        value: currentUser.department
      }),
      getAttendanceRecords(
        currentUser.department,
        currentUser.id,
        canManageSemesterData(currentUser.role)
      ),
      readFirestoreCollection<AttendanceNotification>('notifications', {
        field: 'department',
        value: currentUser.department
      }),
      canManageSemesterData(currentUser.role)
        ? readFirestoreCollection<StudentDetail>('students', {
          field: 'department',
          value: currentUser.department
        })
        : Promise.resolve([])
    ])
      .then(async ([stopCourses, stopTimetable, cloudSessions, cloudRecords, cloudNotifications, cloudStudents]) => {
        unsubscribeCourses = stopCourses;
        unsubscribeTimetable = stopTimetable;
        if (!isActive) {
          stopCourses();
          stopTimetable();
          return;
        }
        if (canManageSemesterData(currentUser.role)) {
          const accessCodes = await getSessionAccessCodes();
          setSessions(cloudSessions.map((session) => ({
            ...session,
            accessCode: accessCodes[session.id]
          })));
        } else {
          setSessions(cloudSessions);
        }
        setRecords(cloudRecords);
        setNotifications(cloudNotifications.filter((notification) =>
          !notification.targetUserId || notification.targetUserId === currentUser.id
        ));
        setStudents(cloudStudents);
        otherDataLoaded = true;
        markReadyIfLoaded();
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        showToast(`Could not load Firestore data: ${firebaseErrorMessage(error)}`);
      });

    return () => {
      isActive = false;
      unsubscribeCourses?.();
      unsubscribeTimetable?.();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !isDevAdmin(currentUser)) {
      setDevSnapshot(EMPTY_DEV_SNAPSHOT);
      setDevLastUpdated(null);
      setDevSnapshotError(null);
      return;
    }
    let isActive = true;
    let isLoading = false;
    const refresh = async () => {
      if (isLoading) return;
      isLoading = true;
      setDevSnapshotLoading(true);
      try {
        const next = await getDevAdminSnapshot();
        if (!isActive) return;
        setDevSnapshot(next);
        setCourses(next.courses);
        setSessions(next.sessions);
        setRecords(next.records);
        setTimetable(next.timetable);
        setNotifications(next.notifications.filter((notification) =>
          !notification.targetUserId || notification.targetUserId === currentUser.id
        ));
        setStudents(next.students);
        setDevLastUpdated(new Date());
        setDevSnapshotError(null);
      } catch (error) {
        if (isActive) {
          setDevSnapshotError(firebaseErrorMessage(error));
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'functions/permission-denied'
          ) {
            setDevSnapshot(EMPTY_DEV_SNAPSHOT);
            setCurrentUser(null);
            void signOutFirebaseAccount().catch((signOutError: unknown) =>
              showToast(`Could not end the deactivated session: ${firebaseErrorMessage(signOutError)}`)
            );
          }
        }
      } finally {
        isLoading = false;
        if (isActive) setDevSnapshotLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    // Firestore is the cross-device source of truth. Storage events only prompt
    // an early refresh in this browser; production cross-device updates use Firebase.
    const onStorage = () => void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      isActive = false;
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('uniuyo_pulse_theme', themeMode);
      document.documentElement.style.setProperty(
        '--background',
        themeMode === 'lights_out' ? '#020817' : '#F8FAFC'
      );
      document.documentElement.style.colorScheme = themeMode === 'lights_out' ? 'dark' : 'light';
    }
  }, [themeMode]);

  useEffect(() => {
    if (currentUser) {
      window.scrollTo(0, 0);
    }
  }, [currentUser, activeTab]);

  // Sign out handler: clears the session and returns to the public home page.
  const handleLogout = async () => {
    soundManager.playClick();
    if (currentUser) {
      try {
        await logActivity({
          action: 'auth.sign_out',
          targetType: 'account',
          targetId: currentUser.id,
          details: 'User signed out.'
        });
      } catch (error) {
        showToast(`Sign-out audit entry failed: ${firebaseErrorMessage(error)}`);
      }
    }
    if (firebaseAuth.currentUser) {
      try {
        await signOutFirebaseAccount();
      } catch (error: unknown) {
        showToast(`Could not sign out of Firebase: ${firebaseErrorMessage(error)}`);
        return;
      }
    }
    setCurrentUser(null);
    setPendingVerificationEmail(null);
    setIsMobileDrawerOpen(false);
    setActiveTab('dashboard');
    showToast('You have been signed out successfully.');
  };

  const handleSaveProfile = async (user: User) => {
    const updatedUser = await updateFirebaseUserProfile(user);
    setCurrentUser(updatedUser);
    setStudents((previous) => previous.map((student) =>
      student.id === updatedUser.id
        ? {
          ...student,
          fullName: updatedUser.fullName,
          studentId: updatedUser.studentId ?? '',
          department: updatedUser.department,
          faculty: updatedUser.faculty,
          level: updatedUser.level,
          semester: updatedUser.semester,
          academicSession: updatedUser.academicSession
        }
        : student
    ));
    try {
      await logActivity({
        action: 'profile.updated',
        targetType: 'account',
        targetId: updatedUser.id,
        details: 'User updated profile details.'
      });
    } catch (error) {
      showToast(`Profile saved, but audit entry failed: ${firebaseErrorMessage(error)}`);
    }
    showToast('Your profile has been updated.');
  };

  // Successful sign in handler: restores user and navigates to portal dashboard
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab(isDevAdmin(user) ? 'dev_live_ops' : 'dashboard');
    void logActivity({
      action: 'auth.sign_in',
      targetType: 'account',
      targetId: user.id,
      details: 'User signed in.'
    }).catch((error: unknown) => showToast(`Sign-in audit entry failed: ${firebaseErrorMessage(error)}`));
    window.scrollTo(0, 0);
    showToast(`Welcome back, ${user.fullName.split(' ')[0]}!`);
  };

  // Submit attendance from GPS verification modal
  const handleSubmitRecord = async (checkIn: AttendanceCheckIn): Promise<AttendanceRecord> => {
    if (!currentUser || !canCheckInToSession(currentUser.role)) {
      throw new Error('Only students and course representatives can submit attendance check-ins.');
    }
    if (isStudent(currentUser)) {
      const session = sessions.find((item) => item.id === checkIn.sessionId);
      if (!getStudentTermName(currentUser)) {
        throw new Error('Set your semester and academic session in your profile before checking in.');
      }
      if (!session || !sessionMatchesStudentTerm(session, currentUser)) {
        throw new Error('This attendance session does not match your profile semester and academic session.');
      }
    }

    let newRecord: AttendanceRecord;
    try {
      newRecord = await submitAttendanceCheckIn(checkIn);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check-in was rejected.';
      try {
        await logActivity({
          action: 'attendance.check_in_rejected',
          targetType: 'session',
          targetId: checkIn.sessionId,
          details: message
        });
      } catch (auditError) {
        showToast(`Check-in rejected; audit entry failed: ${firebaseErrorMessage(auditError)}`);
      }
      throw error;
    }
    setRecords((prev) => {
      const exists = prev.some(
        (r) => r.sessionId === newRecord.sessionId && r.studentId === newRecord.studentId
      );
      if (exists) return prev;
      return [newRecord, ...prev];
    });

    // Add confirmation notification
    const newNotif: AttendanceNotification = {
      id: `notif_${Date.now()}`,
      type: 'attendance_confirmed',
      title: 'Attendance Verified',
      body: `Your GPS location was verified for ${newRecord.courseCode} at ${newRecord.distanceFromClassMeters}m from classroom center. Status: ${newRecord.status}.`,
      timestamp: 'Just now',
      read: false,
      courseCode: newRecord.courseCode,
      sessionId: newRecord.sessionId
    };
    setNotifications((prev) => [newNotif, ...prev]);
    showToast('Attendance recorded and verified successfully!');
    return newRecord;
  };

  // Create new session from Course Rep / Admin
  const handleCreateSession = async (newSession: NewAttendanceSession) => {
    if (!currentUser || !can(currentUser, 'semester.manage')) {
      throw new Error('This account cannot open an attendance session.');
    }
    if (!currentUser) throw new Error('Sign in before opening an attendance session.');
    const createdSession = await createAttendanceSession(newSession);
    setSessions((prev) => [createdSession, ...prev]);
    if (!isLecturer(currentUser)) {
      setCheckInSession(createdSession);
    }
    showToast(
      `Session opened for ${createdSession.courseCode}. Verification code: ${createdSession.accessCode}. Share it in person and keep this device at the detected location.`
    );
  };

  // Close session
  const handleEndSession = async (sessionId: string) => {
    if (!currentUser || !can(currentUser, 'sessions.forceClose') && !can(currentUser, 'semester.manage')) {
      showToast('You are not authorized to close attendance sessions.');
      return;
    }
    try {
      await closeAttendanceSession(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId
          ? { ...s, status: 'closed' as const, accessCode: undefined }
          : s))
      );
      showToast('Attendance session has been closed');
    } catch (error) {
      showToast(`Could not close attendance session: ${firebaseErrorMessage(error)}`);
    }
  };

  const handleAssignStudentRole = async (
    student: StudentDetail,
    role: CourseRepRole | 'student'
  ) => {
    if (!can(currentUser, 'students.assignRoles')) {
      showToast('Only lecturers can assign course representative roles.');
      return;
    }

    try {
      await assignStudentCourseRepRole(student, role);
      setStudents((previous) =>
        previous.map((item) => item.id === student.id ? { ...item, role } : item)
      );
      const roleName = role === 'course_rep_admin'
        ? 'Course Rep Admin'
        : role === 'assistant_course_rep'
          ? 'Assistant Course Rep'
          : 'Student';
      showToast(`${student.fullName} is now assigned as ${roleName}.`);
    } catch (error) {
      showToast(`Could not update ${student.fullName}'s role: ${firebaseErrorMessage(error)}`);
    }
  };

  // Mark notifications read
  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSelectNotification = (n: AttendanceNotification) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
    );
    if (n.sessionId) {
      const s = sessions.find((sess) => sess.id === n.sessionId);
      if (s) {
        if (
          canCheckInToSession(currentUser.role) &&
          s.status === 'active' &&
          (!isStudent(currentUser) || sessionMatchesStudentTerm(s, currentUser))
        ) {
          setCheckInSession(s);
        } else if (isStudent(currentUser) && !getStudentTermName(currentUser)) {
          showToast('Set your semester and academic session in your profile before checking in.');
          setActiveTab('profile');
        } else if (isStudent(currentUser)) {
          showToast('This attendance session does not match your profile semester and academic session.');
        } else {
          setActiveTab('sessions');
        }
      }
    }
  };

  const isDarkTheme = themeMode === 'lights_out';
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'lights_out' : 'light'));
  };

  // If signed out, present the official AuthPage login view before deriving
  // user-scoped course, timetable, and session data.
  if (!currentUser) {
    return (
      <div
        data-theme={themeMode}
        className={`min-h-screen ${isDarkTheme ? 'theme-dark' : 'theme-light'}`}
      >
        <AuthPage
          onLoginSuccess={handleLoginSuccess}
          pendingVerificationEmail={pendingVerificationEmail}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="py-3 px-5 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-xl flex items-center gap-2.5 border border-slate-800">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab.startsWith('dev_') && !can(currentUser, 'dev.access')) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-slate-900">Access denied</h1>
          <p className="mt-2 text-sm text-slate-600">The management console is restricted to verified dev administrators.</p>
          <button onClick={() => setActiveTab('dashboard')} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Return to dashboard</button>
        </section>
      </main>
    );
  }

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const departmentCourses = courses.filter(
    (course) => normalizeAcademicValue(course.department) === normalizeAcademicValue(currentUser.department)
  );
  const visibleCourses = isLecturer(currentUser)
    ? departmentCourses
    : departmentCourses.filter(
      (course) =>
        normalizeAcademicValue(course.level) === normalizeAcademicValue(currentUser.level) &&
        (!isStudent(currentUser) ||
          (Boolean(getStudentTermName(currentUser)) &&
            normalizeAcademicValue(course.semesterName ?? '') ===
              normalizeAcademicValue(getStudentTermName(currentUser) ?? '')))
    );
  const visibleTimetable = timetable.filter((entry) => {
    if (normalizeAcademicValue(entry.department ?? '') !== normalizeAcademicValue(currentUser.department)) {
      return false;
    }
    return isLecturer(currentUser) ||
      normalizeAcademicValue(entry.level ?? '') === normalizeAcademicValue(currentUser.level);
  });
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id));
  const visibleActiveSessions = isDevAdmin(currentUser)
    ? sessions.filter((session) =>
      session.status !== 'closed' &&
      Date.parse(session.startTime) <= Date.now() &&
      Date.parse(session.endTime) >= Date.now()
    )
    : activeSessions.filter((session) =>
      visibleCourseIds.has(session.courseId) &&
      (!isStudent(currentUser) || sessionMatchesStudentTerm(session, currentUser))
    );
  const visibleSessions = isDevAdmin(currentUser)
    ? sessions
    : sessions.filter((session) =>
      visibleCourseIds.has(session.courseId) &&
      (!isStudent(currentUser) || sessionMatchesStudentTerm(session, currentUser))
    );
  const unreadCount = notifications.filter((n) => !n.read).length;
  return (
    <div
      data-theme={themeMode}
      className={`min-h-screen flex text-slate-900 font-sans antialiased selection:bg-[#008751]/20 ${isDarkTheme ? 'theme-dark' : 'theme-light'}`}
    >
      {/* Fixed Left Sidebar */}
      <Suspense fallback={null}>
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onLogout={handleLogout}
          activeSessionCount={visibleActiveSessions.length}
        />
      </Suspense>

      {/* Main Content View with Sticky Top Header */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Suspense fallback={null}>
          <TopHeader
            currentUser={currentUser}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            onSelectNotification={handleSelectNotification}
            onLogout={handleLogout}
            onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
            searchQuery={globalSearch}
            onSearchChange={setGlobalSearch}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
          />
        </Suspense>

        {/* Viewport Content */}
        {isDevAdmin(currentUser) ? (
          <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-[1500px] w-full mx-auto pb-16">
            <Suspense fallback={<div role="status" className="p-8">Loading management console…</div>}>
              <DevAdminConsole
                currentUser={currentUser}
                activeTab={activeTab}
                data={devSnapshot}
                lastUpdated={devLastUpdated}
                loading={devSnapshotLoading}
                error={devSnapshotError}
                onRefresh={() => {
                  void getDevAdminSnapshot().then((snapshot) => {
                    setDevSnapshot(snapshot);
                    setDevLastUpdated(new Date());
                    setDevSnapshotError(null);
                  }).catch((error: unknown) => setDevSnapshotError(firebaseErrorMessage(error)));
                }}
                onActionComplete={() => {
                  void getDevAdminSnapshot().then((snapshot) => {
                    setDevSnapshot(snapshot);
                    setDevLastUpdated(new Date());
                    setDevSnapshotError(null);
                  }).catch((error: unknown) => setDevSnapshotError(firebaseErrorMessage(error)));
                }}
              />
            </Suspense>
          </main>
        ) : (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-16">
          <Suspense fallback={<div className="min-h-[60vh]" role="status">Loading view…</div>}>
          {/* DASHBOARD VIEW */}
          {(activeTab === 'dashboard' || activeTab === 'home') && (
            isStudent(currentUser) ? (
              <StudentDashboard
                currentUser={currentUser}
                courses={visibleCourses}
                activeSessions={visibleActiveSessions}
                records={records}
                timetable={visibleTimetable}
                onOpenCheckIn={(session) => setCheckInSession(session)}
                onViewSlip={(rec) => setViewSlipRecord(rec)}
                onNavigateTab={setActiveTab}
              />
            ) : (
              <AdminDashboardView
                currentUser={currentUser}
                courses={visibleCourses}
                sessions={visibleSessions}
                records={records}
                students={students}
                onOpenCreateSession={() => setIsCreateSessionOpen(true)}
                onSelectSession={(session) => {
                  setActiveTab('sessions');
                }}
                onEndSession={handleEndSession}
                onNavigateTab={setActiveTab}
              />
            )
          )}

          {/* COURSES VIEW */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              {canManageSemesterData(currentUser.role) && (
                firebaseAuth.currentUser && firebaseDataReadyForUid !== firebaseAuth.currentUser.uid
                  ? <div role="status">Loading course tables…</div>
                  : (
                    <Suspense fallback={<div role="status">Loading course manager…</div>}>
                      <CourseManagementView
                        currentUser={currentUser}
                        courses={departmentCourses}
                        timetable={timetable.filter((entry) =>
                          normalizeAcademicValue(entry.department ?? '') === normalizeAcademicValue(currentUser.department)
                        )}
                        onSave={handleSaveSemesterCourses}
                      />
                    </Suspense>
                  )
              )}
              <StudentCoursesView
                currentUser={currentUser}
                courses={visibleCourses}
                records={records}
                onSelectCourse={(course) => setActiveTab('records')}
              />
            </div>
          )}

          {/* STUDENTS DIRECTORY VIEW (Rep & Admin) */}
          {activeTab === 'students' && (
            <StudentsView
              students={students}
              canAssignRoles={can(currentUser, 'students.assignRoles')}
              onAssignRole={handleAssignStudentRole}
            />
          )}

          {/* ATTENDANCE SESSIONS VIEW (Rep & Admin) */}
          {activeTab === 'sessions' && (
            <SessionsView
              sessions={visibleSessions}
              records={records}
              courses={visibleCourses}
              students={students}
              currentUser={currentUser}
              onOpenCreateSession={() => setIsCreateSessionOpen(true)}
              onSelectSession={(session) => {
                if (
                  canCheckInToSession(currentUser.role) &&
                  session.status === 'active' &&
                  (!isStudent(currentUser) || sessionMatchesStudentTerm(session, currentUser))
                ) {
                  setCheckInSession(session);
                } else if (isStudent(currentUser) && !getStudentTermName(currentUser)) {
                  showToast('Set your semester and academic session in your profile before checking in.');
                  setActiveTab('profile');
                } else if (isStudent(currentUser)) {
                  showToast('This attendance session does not match your profile semester and academic session.');
                } else {
                  setActiveTab('records');
                }
              }}
              onEndSession={handleEndSession}
            />
          )}

          {/* ATTENDANCE RECORDS & AUDIT TRAIL */}
          {(activeTab === 'records' || activeTab === 'history') && (
            <RecordsView
              records={records}
              courses={visibleCourses}
              currentUser={currentUser}
              onViewSlip={(rec) => setViewSlipRecord(rec)}
            />
          )}

          {/* SEMESTER REPORTS & ELIGIBILITY */}
          {activeTab === 'reports' && can(currentUser, 'reports.view') && (
            <ReportsView
              courses={visibleCourses}
              students={students}
              currentUser={currentUser}
            />
          )}

          {/* CALENDAR & TIMETABLE */}
          {activeTab === 'calendar' && (
            firebaseAuth.currentUser &&
            canManageSemesterData(currentUser.role) &&
            firebaseDataReadyForUid !== firebaseAuth.currentUser.uid
              ? <div role="status">Loading timetable…</div>
              : (
                <Suspense fallback={<div role="status">Loading calendar…</div>}>
                  <CalendarView
                    timetable={visibleTimetable}
                    managementTimetable={timetable.filter((entry) =>
                      normalizeAcademicValue(entry.department ?? '') === normalizeAcademicValue(currentUser.department)
                    )}
                    courses={visibleCourses}
                    activeSessions={visibleActiveSessions}
                    currentUser={currentUser}
                    canManageTimetables={canManageSemesterData(currentUser.role)}
                    onSaveTimetable={handleSaveSemesterTimetable}
                    onOpenCheckIn={(session) => setCheckInSession(session)}
                  />
                </Suspense>
              )
          )}

          {/* USER PROFILE */}
          {activeTab === 'profile' && (
            <Suspense fallback={<div role="status">Loading profile…</div>}>
              <ProfileView currentUser={currentUser} onSaveProfile={handleSaveProfile} />
            </Suspense>
          )}

          {/* SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <Suspense fallback={<div role="status">Loading settings…</div>}>
            <SettingsView
              currentUser={currentUser}
              onLogout={handleLogout}
            />
            </Suspense>
          )}
          </Suspense>
        </main>
        )}
      </div>

      {/* GPS ATTENDANCE CHECK-IN MODAL (The Hero Trust Signal) */}
      <Suspense fallback={null}>
        {checkInSession && (
          <GPSVerificationModal
            session={checkInSession}
            student={currentUser}
            onClose={() => setCheckInSession(null)}
            onSubmitRecord={handleSubmitRecord}
            onViewSlip={(rec) => {
              setCheckInSession(null);
              setViewSlipRecord(rec);
            }}
            existingRecord={records.find(
              (r) => r.sessionId === checkInSession.id && r.studentId === currentUser.id
            )}
          />
        )}
      </Suspense>

      {/* CREATE ATTENDANCE SESSION MODAL */}
      <Suspense fallback={null}>
        {isCreateSessionOpen && (
          <CreateSessionModal
            courses={visibleCourses}
            onClose={() => setIsCreateSessionOpen(false)}
            onCreateSession={handleCreateSession}
          />
        )}
      </Suspense>

      {/* OFFICIAL VERIFICATION SLIP MODAL */}
      <Suspense fallback={null}>
        {viewSlipRecord && (
          <VerificationSlipModal
            record={viewSlipRecord}
            onClose={() => setViewSlipRecord(null)}
          />
        )}
      </Suspense>

      {/* MOBILE RIGHT-HAND SLIDING NAVIGATION DRAWER */}
      <Suspense fallback={null}>
        {isMobileDrawerOpen && (
          <MobileRightDrawer
            isOpen={isMobileDrawerOpen}
            onClose={() => setIsMobileDrawerOpen(false)}
            currentUser={currentUser}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLogout={handleLogout}
            activeSessions={visibleActiveSessions}
            onOpenCheckIn={(session) => setCheckInSession(session)}
            onOpenCreateSession={() => setIsCreateSessionOpen(true)}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
          />
        )}
      </Suspense>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="py-3 px-5 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-xl flex items-center gap-2.5 border border-slate-800">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
