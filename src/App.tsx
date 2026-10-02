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
import {
  firebaseAuth,
  firebaseErrorMessage,
  assignStudentCourseRepRole,
  getFirebaseUserProfile,
  readFirestoreCollection,
  replaceFirestoreCollection,
  replaceSemesterDepartmentData,
  replaceSemesterTimetableData,
  subscribeFirestoreCollection,
  signOutFirebaseAccount,
  syncStudentDirectoryProfile,
  updateFirebaseUserProfile
} from './lib/firebase';
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

function normalizeAcademicValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getStudentTermName(user: User): string | null {
  if (user.role !== 'student' || !user.semester || !user.academicSession) return null;
  return `${user.semester} ${user.academicSession}`;
}

function sessionMatchesStudentTerm(session: AttendanceSession, user: User): boolean {
  const termName = getStudentTermName(user);
  return Boolean(termName && session.semesterName &&
    normalizeAcademicValue(session.semesterName) === normalizeAcademicValue(termName));
}

function canManageSemesterData(role: User['role']): boolean {
  return role === 'lecturer' ||
    role === 'course_rep_admin' ||
    role === 'assistant_course_rep' ||
    role === 'rep_admin';
}

function canCheckInToSession(role: User['role']): boolean {
  return role === 'student' ||
    role === 'course_rep_admin' ||
    role === 'assistant_course_rep' ||
    role === 'rep_admin';
}

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
    await replaceSemesterDepartmentData(scopedData, department);
    setCourses((previous) => [
      ...previous.filter((course) =>
        course.semesterId !== scopedData.semesterId ||
        normalizeAcademicValue(course.department) !== departmentKey
      ),
      ...scopedData.courses
    ]);
    setTimetable((previous) => [
      ...previous.filter((entry) =>
        entry.semesterId !== scopedData.semesterId ||
        normalizeAcademicValue(entry.department ?? '') !== departmentKey
      ),
      ...scopedData.timetable
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
    const department = currentUser.department.trim();
    const scopedEntries = entries.map((entry) => ({ ...entry, department }));
    await replaceSemesterTimetableData(semesterId, scopedEntries, department);
    setTimetable((previous) => [
      ...previous.filter((entry) =>
        entry.semesterId !== semesterId ||
        normalizeAcademicValue(entry.department ?? '') !== departmentKey
      ),
      ...scopedEntries
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
          return syncStudentDirectoryProfile(authUser.uid, user).then(() => {
            if (firebaseAuth.currentUser?.uid === authUser.uid) {
              setCurrentUser(user);
            }
          });
        })
        .catch((error: unknown) => showToast(`Could not restore Firebase account: ${firebaseErrorMessage(error)}`));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const authUser = firebaseAuth.currentUser;
    if (!currentUser || !authUser) {
      setFirebaseDataReadyForUid(null);
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
        (error) => showToast(`Could not load courses from Firestore: ${firebaseErrorMessage(error)}`)
      ),
      subscribeFirestoreCollection<TimetableEntry>(
        'timetable',
        (items) => {
          if (!isActive) return;
          setTimetable(items);
          timetableLoaded = true;
          markReadyIfLoaded();
        },
        (error) => showToast(`Could not load timetable from Firestore: ${firebaseErrorMessage(error)}`)
      ),
      readFirestoreCollection<AttendanceSession>('sessions'),
      readFirestoreCollection<AttendanceRecord>('records'),
      readFirestoreCollection<AttendanceNotification>('notifications'),
      readFirestoreCollection<StudentDetail>('students')
    ])
      .then(([stopCourses, stopTimetable, cloudSessions, cloudRecords, cloudNotifications, cloudStudents]) => {
        unsubscribeCourses = stopCourses;
        unsubscribeTimetable = stopTimetable;
        if (!isActive) {
          stopCourses();
          stopTimetable();
          return;
        }
        setSessions(cloudSessions);
        setRecords(cloudRecords);
        setNotifications(cloudNotifications);
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

  const saveCollectionToCloud = <T extends { id: string }>(collectionName: string, items: T[]) => {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid || uid !== firebaseDataReadyForUid) return;
    replaceFirestoreCollection(collectionName, items).catch((error: unknown) => {
      showToast(`Could not save ${collectionName} to Firestore: ${firebaseErrorMessage(error)}`);
    });
  };

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

  useEffect(() => saveCollectionToCloud('sessions', sessions), [sessions, firebaseDataReadyForUid]);
  useEffect(() => saveCollectionToCloud('records', records), [records, firebaseDataReadyForUid]);
  useEffect(() => saveCollectionToCloud('notifications', notifications), [notifications, firebaseDataReadyForUid]);
  useEffect(() => saveCollectionToCloud('students', students), [students, firebaseDataReadyForUid]);

  // Sign out handler: clears the session and returns to the public home page.
  const handleLogout = async () => {
    soundManager.playClick();
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
    await updateFirebaseUserProfile(user);
    setCurrentUser(user);
    setStudents((previous) => previous.map((student) =>
      student.id === user.id
        ? {
          ...student,
          fullName: user.fullName,
          studentId: user.studentId ?? '',
          department: user.department,
          faculty: user.faculty,
          level: user.level,
          semester: user.semester,
          academicSession: user.academicSession
        }
        : student
    ));
    showToast('Your profile has been updated.');
  };

  // Successful sign in handler: restores user and navigates to portal dashboard
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    window.scrollTo(0, 0);
    showToast(`Welcome back, ${user.fullName.split(' ')[0]}!`);
  };

  // Submit attendance from GPS verification modal
  const handleSubmitRecord = (newRecord: AttendanceRecord) => {
    if (!currentUser || !canCheckInToSession(currentUser.role)) {
      showToast('Only students and course representatives can submit attendance check-ins.');
      return;
    }
    if (newRecord.studentId !== currentUser.id) {
      showToast('Attendance can only be submitted for the signed-in account.');
      return;
    }
    if (currentUser.role === 'student') {
      const session = sessions.find((item) => item.id === newRecord.sessionId);
      if (!getStudentTermName(currentUser)) {
        showToast('Set your semester and academic session in your profile before checking in.');
        return;
      }
      if (!session || !sessionMatchesStudentTerm(session, currentUser)) {
        showToast('This attendance session does not match your profile semester and academic session.');
        return;
      }
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
      body: `Your GPS location was verified for ${newRecord.courseCode} at ${newRecord.distanceFromClassMeters}m from classroom center. Status: Present.`,
      timestamp: 'Just now',
      read: false,
      courseCode: newRecord.courseCode,
      sessionId: newRecord.sessionId
    };
    setNotifications((prev) => [newNotif, ...prev]);
    showToast('Attendance recorded and verified successfully!');
  };

  // Create new session from Course Rep / Admin
  const handleCreateSession = (newSession: AttendanceSession) => {
    setSessions((prev) => [newSession, ...prev]);
    if (currentUser.role !== 'lecturer') {
      setCheckInSession(newSession);
    }

    // Dispatch notification
    const newNotif: AttendanceNotification = {
      id: `notif_${Date.now()}`,
      type: 'session_opened',
      title: 'New Attendance Broadcast',
      body: `${currentUser.fullName} opened live GPS attendance for ${newSession.courseCode} at ${newSession.locationName}. Radius: ${newSession.radiusMeters}m.`,
      timestamp: 'Just now',
      read: false,
      courseCode: newSession.courseCode,
      sessionId: newSession.id
    };
    setNotifications((prev) => [newNotif, ...prev]);
    showToast(
      `Session opened for ${newSession.courseCode}. Verification code: ${newSession.accessCode}. Share it in person and keep this device at the detected location.`
    );
  };

  // Close session
  const handleEndSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'closed' as const } : s))
    );
    showToast('Attendance session has been closed');
  };

  const handleAssignStudentRole = async (
    student: StudentDetail,
    role: CourseRepRole | 'student'
  ) => {
    if (currentUser.role !== 'lecturer') {
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
          (currentUser.role !== 'student' || sessionMatchesStudentTerm(s, currentUser))
        ) {
          setCheckInSession(s);
        } else if (currentUser.role === 'student' && !getStudentTermName(currentUser)) {
          showToast('Set your semester and academic session in your profile before checking in.');
          setActiveTab('profile');
        } else if (currentUser.role === 'student') {
          showToast('This attendance session does not match your profile semester and academic session.');
        } else {
          setActiveTab('sessions');
        }
      }
    }
  };

  const isDarkTheme = themeMode === 'lights_out';

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

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const departmentCourses = courses.filter(
    (course) => normalizeAcademicValue(course.department) === normalizeAcademicValue(currentUser.department)
  );
  const visibleCourses = currentUser.role === 'lecturer'
    ? departmentCourses
    : departmentCourses.filter(
      (course) =>
        normalizeAcademicValue(course.level) === normalizeAcademicValue(currentUser.level) &&
        (currentUser.role !== 'student' ||
          (Boolean(getStudentTermName(currentUser)) &&
            normalizeAcademicValue(course.semesterName ?? '') ===
              normalizeAcademicValue(getStudentTermName(currentUser) ?? '')))
    );
  const visibleTimetable = timetable.filter((entry) => {
    if (normalizeAcademicValue(entry.department ?? '') !== normalizeAcademicValue(currentUser.department)) {
      return false;
    }
    return currentUser.role === 'lecturer' ||
      normalizeAcademicValue(entry.level ?? '') === normalizeAcademicValue(currentUser.level);
  });
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id));
  const visibleActiveSessions = activeSessions.filter((session) =>
    visibleCourseIds.has(session.courseId) &&
    (currentUser.role !== 'student' || sessionMatchesStudentTerm(session, currentUser))
  );
  const visibleSessions = sessions.filter((session) =>
    visibleCourseIds.has(session.courseId) &&
    (currentUser.role !== 'student' || sessionMatchesStudentTerm(session, currentUser))
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'lights_out' : 'light'));
  };

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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-16">
          <Suspense fallback={<div className="min-h-[60vh]" role="status">Loading view…</div>}>
          {/* DASHBOARD VIEW */}
          {(activeTab === 'dashboard' || activeTab === 'home') && (
            currentUser.role === 'student' ? (
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
              canAssignRoles={currentUser.role === 'lecturer'}
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
                  (currentUser.role !== 'student' || sessionMatchesStudentTerm(session, currentUser))
                ) {
                  setCheckInSession(session);
                } else if (currentUser.role === 'student' && !getStudentTermName(currentUser)) {
                  showToast('Set your semester and academic session in your profile before checking in.');
                  setActiveTab('profile');
                } else if (currentUser.role === 'student') {
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
          {activeTab === 'reports' && currentUser.role !== 'student' && (
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
              onLogout={handleLogout}
            />
            </Suspense>
          )}
          </Suspense>
        </main>
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
            currentUser={currentUser}
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
