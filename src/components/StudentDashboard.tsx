import React from 'react';
import {
  Radio,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Calendar,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { AttendanceSession, AttendanceRecord, Course, User, TimetableEntry } from '../types';
import { soundManager } from '../lib/sound';
import { useTimeGreeting, getTimeEmoji } from '../lib/timeGreeting';

interface StudentDashboardProps {
  currentUser: User;
  courses: Course[];
  activeSessions: AttendanceSession[];
  records: AttendanceRecord[];
  timetable: TimetableEntry[];
  onOpenCheckIn: (session: AttendanceSession) => void;
  onViewSlip: (record: AttendanceRecord) => void;
  onNavigateTab: (tab: any) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  courses,
  activeSessions,
  records,
  timetable,
  onOpenCheckIn,
  onViewSlip,
  onNavigateTab
}) => {
  // Current active session for student (first active session in enrolled courses)
  const activeSession = activeSessions[0] || null;
  const hasAcademicTerm = Boolean(currentUser.semester && currentUser.academicSession);

  // Check if current student already checked in to the active session
  const alreadyCheckedIn = activeSession
    ? records.find((r) => r.sessionId === activeSession.id && r.studentId === currentUser.id)
    : null;

  const studentRecords = records.filter((record) =>
    record.studentId === currentUser.id &&
    (!hasAcademicTerm ||
      !record.semesterName ||
      record.semesterName.trim().toLowerCase() ===
        `${currentUser.semester} ${currentUser.academicSession}`.trim().toLowerCase())
  );
  const presentCount = studentRecords.filter((record) => record.status === 'present').length;
  const lateCount = studentRecords.filter((record) => record.status === 'late').length;
  const absentCount = studentRecords.filter((record) => record.status === 'absent').length;

  const { greeting, period, timeString, timeZoneShort } = useTimeGreeting();
  const TimeIcon = getTimeEmoji(period);

  return (
    <div className="home-dashboard min-w-0 space-y-6">
      {/* Header Greeting per Section 6 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
            <span>{greeting}, {currentUser.fullName.split(' ')[0]}</span>
            <TimeIcon
              className="w-4 h-4 text-slate-500"
              aria-hidden="true"
              title={`Detected local time: ${timeString} (${timeZoneShort || 'Local Time'})`}
            />
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Here's your attendance overview for this semester.</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{timeString}</span>
              {timeZoneShort && <span>({timeZoneShort})</span>}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-full break-words px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700">
            {currentUser.department} • {currentUser.level}
          </span>
          <span className="max-w-full break-all px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
            {currentUser.studentId || currentUser.email}
          </span>
        </div>
      </div>

      {!hasAcademicTerm && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-amber-900">
            Add your semester and academic session to your profile to view matching attendance sessions and check in.
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            className="shrink-0 rounded-xl bg-amber-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-amber-800"
          >
            Complete profile
          </button>
        </div>
      )}

      {/* Statistics Cards (Section 6) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Present */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Present</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{presentCount}</span>
            <p className="text-xs text-slate-500 mt-0.5">This semester</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <span>Verified on-campus</span>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Late</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{lateCount}</span>
            <p className="text-xs text-slate-500 mt-0.5">This semester</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
              <span>Grace period check-ins</span>
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Absent</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{absentCount}</span>
            <p className="text-xs text-slate-500 mt-0.5">This semester</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <span>Excused / missed</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7: ACTIVE ATTENDANCE CARD (The Visual Hero Centerpiece) */}
      <div className="bg-gradient-to-br from-[#820019] via-[#A50021] to-[#4A0710] rounded-3xl p-4 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Ambient Decorative Radar Circle */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full border border-red-300/20 pointer-events-none" />
        <div className="absolute -right-32 -bottom-32 w-112 h-112 rounded-full border border-red-300/10 pointer-events-none" />

        {activeSession ? (
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4 max-w-xl">
              {/* Status Header Badge */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500 text-white shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Attendance Open</span>
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white/10 text-red-100 border border-white/10 backdrop-blur-xs">
                  Live Geofence Active
                </span>
              </div>

              {/* Course Title & Code */}
              <div>
                <span className="text-sm font-bold text-red-200 uppercase tracking-wider">
                  Active Attendance
                </span>
                <h3 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-0.5 break-words">
                  {activeSession.courseCode} — {activeSession.courseTitle}
                </h3>
              </div>

              {/* Classroom Location & Session Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10">
                  <span className="text-red-100 flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5" /> Classroom
                  </span>
                  <p className="font-bold text-white truncate">{activeSession.locationName}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10">
                  <span className="text-red-100 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5" /> Time Window
                  </span>
                  <p className="font-bold text-white">
                    {new Date(activeSession.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' – '}
                    {new Date(activeSession.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-red-100 flex items-center gap-1 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Geofence Radius
                  </span>
                  <p className="font-bold text-white">{activeSession.radiusMeters}m from Course Rep</p>
                </div>
              </div>
            </div>

            {/* Verification Action CTA */}
            <div className="flex flex-col items-center sm:items-end justify-center shrink-0">
              {alreadyCheckedIn ? (
                <div className="w-full sm:w-auto p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md text-center sm:text-right space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attendance Marked & Verified</span>
                  </div>
                  <p className="text-xs text-red-100">
                    Recorded at {new Date(alreadyCheckedIn.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {alreadyCheckedIn.distanceFromClassMeters}m from course rep
                  </p>
                  <button
                    onClick={() => onViewSlip(alreadyCheckedIn)}
                    className="w-full sm:w-auto mt-2 px-4 py-2.5 bg-white text-[#820019] hover:bg-red-50 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Verification Slip</span>
                  </button>
                </div>
              ) : (
                <div className="w-full sm:w-auto text-center sm:text-right space-y-3">
                  <div className="flex items-center justify-center sm:justify-end gap-1.5 text-xs text-red-100 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>
                      {new Date(activeSession.endTime).getTime() > Date.now()
                        ? `Closes at ${new Date(activeSession.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        : 'Attendance window has ended'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onOpenCheckIn(activeSession);
                    }}
                    className="w-full sm:w-auto px-7 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer group"
                  >
                    <Radio className="w-5 h-5 animate-pulse group-hover:scale-110 transition-transform" />
                    <span>Verify Location & Mark Attendance</span>
                  </button>

                  <p className="text-[11px] text-red-200">
                    Must be within {activeSession.radiusMeters}m of the course rep's detected location and enter their verification code.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-red-200 uppercase tracking-wider">
                Current Status
              </span>
              <h3 className="text-xl font-bold text-white">No Active Class Attendance Session Right Now</h3>
              <p className="text-xs text-red-100">
                No active session is open. Your scheduled classes will appear here when available.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('calendar')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>View Timetable</span>
            </button>
          </div>
        )}
      </div>

      {/* Enrolled courses overview */}
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Enrolled Courses</h3>
              <p className="text-xs text-slate-500">Your attendance breakdown</p>
            </div>
            <button
              onClick={() => onNavigateTab('courses')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View All Courses</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.slice(0, 4).map((course, idx) => {
              return (
                <div
                  key={course.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700">
                        {course.code}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{course.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{course.classroom}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {studentRecords.filter((record) => record.courseId === course.id).length} attendance records
                      </span>
                      <span className="font-semibold text-slate-500">View attendance records</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </div>
    </div>
  );
};
