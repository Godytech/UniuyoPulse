export type CourseRepRole = 'course_rep_admin' | 'assistant_course_rep';

export type UserRole = 'student' | CourseRepRole | 'rep_admin' | 'lecturer';

export type ViewMode = 'admin' | 'student';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  studentId?: string; // Reg number e.g. 21/SC/CO/1042
  department: string;
  faculty?: string;
  level: string; // e.g. "100L", "200L", "300L"
  avatar?: string;
  semester?: 'First Semester' | 'Second Semester';
  academicSession?: string;
}

export interface AuthUser extends User {
  createdAt?: string;
}

export interface Course {
  id: string;
  semesterId?: string;
  semesterName?: string;
  code: string;
  title: string;
  department: string;
  level: string;
  repId: string;
  repName: string;
  scheduleDay: string;
  scheduleTime: string;
  classroom: string;
  enrolledStudentCount: number;
}

export type AttendanceSessionStatus = 'scheduled' | 'active' | 'closed';

export interface AttendanceSession {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  semesterId?: string;
  semesterName?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
  lateThresholdMinutes?: number;
  status: AttendanceSessionStatus;
  accessCode: string; // Six-digit in-person attendance verification code
  maxStudents?: number;
  totalAttendees?: number;
  lecturerName?: string;
  lecturerId?: string;
  createdAt?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentRegNo: string;
  status: AttendanceStatus;
  latitude: number;
  longitude: number;
  locationAccuracyMeters: number;
  distanceFromClassMeters: number;
  submittedAt: string; // ISO string
  deviceFingerprint: string;
  verifiedByServer: boolean;
  verificationMethod?: 'gps' | 'gps_code' | 'session_host';
  semesterId?: string;
  semesterName?: string;
}

export interface GeofenceVerification {
  isWithinGeofence: boolean;
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters: number;
  isAccuracyAcceptable: boolean;
  isLate: boolean;
  statusState: 'inside' | 'outside' | 'poor_accuracy' | 'late' | 'expired' | 'closed';
  message: string;
  details?: string;
}

export interface TimetableEntry {
  id: string;
  semesterId?: string;
  semesterName?: string;
  department?: string;
  level?: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  time: string;
  endTime?: string;
  courseCode: string;
  courseTitle: string;
  location: string;
  isCancelled?: boolean;
}

export type ThemeMode = 'lights_out' | 'light';

export interface AttendanceNotification {
  id: string;
  type: 'session_opened' | 'session_closing' | 'schedule_change' | 'attendance_confirmed' | 'geo_alert';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  courseCode?: string;
  sessionId?: string;
}

export type NavTab =
  | 'dashboard'
  | 'courses'
  | 'students'
  | 'sessions'
  | 'records'
  | 'reports'
  | 'calendar'
  | 'profile'
  | 'settings'
  | 'home'
  | 'notifications'
  | 'history'
  | 'admin_dashboard';

export type XNavTab = NavTab;

export interface StudentDetail {
  id: string;
  role?: UserRole;
  fullName: string;
  studentId: string;
  department: string;
  faculty?: string;
  level: string;
  email: string;
  avatar: string;
  semester?: 'First Semester' | 'Second Semester';
  academicSession?: string;
  attendanceRate: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  status: 'Good Standing' | 'Warning' | 'Critical';
  enrolledCourses: {
    courseId: string;
    code: string;
    title: string;
    classesHeld: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
  }[];
}
