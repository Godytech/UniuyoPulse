import React from 'react';
import {
  Users,
  BookOpen,
  Radio,
  TrendingUp,
  Clock,
  Plus,
  StopCircle,
  Eye,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AttendanceSession, AttendanceRecord, Course, StudentDetail, User } from '../types';
import { soundManager } from '../lib/sound';
import { useTimeGreeting, getTimeEmoji } from '../lib/timeGreeting';

interface AdminDashboardViewProps {
  currentUser: User;
  courses: Course[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  students: StudentDetail[];
  onOpenCreateSession: () => void;
  onSelectSession: (session: AttendanceSession) => void;
  onEndSession: (sessionId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  courses,
  sessions,
  records,
  students,
  onOpenCreateSession,
  onSelectSession,
  onEndSession,
  onNavigateTab
}) => {
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const firstName = currentUser.fullName.split(' ')[0] || currentUser.fullName;

  const { greeting, period, timeString, timeZoneShort } = useTimeGreeting();
  const TimeIcon = getTimeEmoji(period);

  const now = new Date();
  const todayRecords = records.filter((record) => {
    const submittedAt = new Date(record.submittedAt);
    return submittedAt.getFullYear() === now.getFullYear() &&
      submittedAt.getMonth() === now.getMonth() &&
      submittedAt.getDate() === now.getDate();
  });
  const getAttendanceRate = (items: AttendanceRecord[]) => {
    if (!items.length) return 0;
    const attended = items.filter((record) => record.status === 'present' || record.status === 'late').length;
    return Math.round((attended / items.length) * 100);
  };
  const todayAttendanceRate = getAttendanceRate(todayRecords);
  const overallAttendanceRate = getAttendanceRate(records);
  const presentCount = records.filter((record) => record.status === 'present').length;
  const lateCount = records.filter((record) => record.status === 'late').length;
  const absentCount = records.filter((record) => record.status === 'absent').length;
  const getStatusPercent = (count: number) => records.length ? Math.round((count / records.length) * 100) : 0;
  const coursePerformance = courses.map((course) => {
    const courseRecords = records.filter((record) => record.courseId === course.id);
    return {
      id: course.id,
      code: course.code,
      name: course.title,
      rate: getAttendanceRate(courseRecords)
    };
  });
  const weeklyAttendance = Array.from({ length: 6 }, (_, index) => {
    const weeksAgo = 5 - index;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (weeksAgo * 7 + 6));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const weekRecords = records.filter((record) => {
      const submittedAt = new Date(record.submittedAt);
      return submittedAt >= start && submittedAt < end;
    });
    return {
      week: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rate: getAttendanceRate(weekRecords)
    };
  });

  return (
    <div className="home-dashboard min-w-0 space-y-6">
      {/* Header Greeting per Section 12 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
            <span>{greeting}, {firstName}</span>
            <TimeIcon
              className="w-4 h-4 text-slate-500"
              aria-hidden="true"
              title={`Detected local time: ${timeString} (${timeZoneShort || 'Local Time'})`}
            />
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Here's what's happening with your courses today.</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{timeString}</span>
              {timeZoneShort && <span>({timeZoneShort})</span>}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenCreateSession();
          }}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Create Attendance Session</span>
        </button>
      </div>

      {/* Statistics Cards (Section 12) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{students.length}</span>
            <p className="text-xs text-slate-500 mt-0.5">Student profiles loaded</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <span>From Firebase</span>
            </div>
          </div>
        </div>

        {/* Active Courses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Courses</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{courses.length}</span>
            <p className="text-xs text-slate-500 mt-0.5">Courses loaded</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <span>From Firebase</span>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Sessions</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
              {activeSessions.length}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">Live GPS geofences open</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
              {activeSessions.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
              <span>{activeSessions.length > 0 ? 'Accepting check-ins now' : 'No open check-ins'}</span>
            </div>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Attendance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{todayAttendanceRate}%</span>
            <p className="text-xs text-slate-500 mt-0.5">Based on today's attendance records</p>
            <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <span>{todayRecords.length} records today</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 14: ACTIVE ATTENDANCE SESSIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">Active Attendance Sessions</h3>
            <p className="text-xs text-slate-500">Live classroom geofences currently accepting student check-ins</p>
          </div>
          <button
            onClick={() => onNavigateTab('sessions')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>All Sessions</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
            <Radio className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No active attendance sessions</p>
            <p className="text-xs text-slate-400">Launch a new session to broadcast GPS geofenced check-in for your class.</p>
            <button
              onClick={onOpenCreateSession}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer"
            >
              Start Session Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {activeSessions.map((session) => {
              const checkedInCount = records.filter((r) => r.sessionId === session.id).length;
              const maxCount = session.maxStudents ?? 0;
              const percent = maxCount > 0 ? Math.min(100, Math.round((checkedInCount / maxCount) * 100)) : 0;

              return (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700">
                          {session.courseCode}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Live Geofence</span>
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {session.accessCode && <>PIN: {session.accessCode}</>}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 line-clamp-1">{session.courseTitle}</h4>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{session.locationName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(session.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {' – '}
                          {new Date(session.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Progress & Radius Badge */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800">
                        {checkedInCount}{maxCount > 0 ? ` / ${maxCount}` : ''} students checked in
                      </span>
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        {session.radiusMeters}m radius
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons: View Attendance & Close Session per Section 14 */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => onSelectSession(session)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Attendance</span>
                    </button>
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        onEndSession(session.id);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Close Session</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 13: ANALYTICS OVERVIEW (Trend, Distribution Donut, Course Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Line / Area Visualizer */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Attendance Trend</h3>
              <p className="text-xs text-slate-500">Weekly average attendance percentage across all courses</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
              Recent six weeks
            </span>
          </div>

          {/* Minimal, High-Craft SVG Trend Chart */}
          <div className="h-48 w-full flex items-end justify-between gap-3 pt-4 px-2">
            {weeklyAttendance.map((d) => (
              <div key={d.week} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <span className="text-[11px] font-bold text-emerald-600 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.rate}%
                </span>
                <div className="w-full max-w-[36px] bg-emerald-50 hover:bg-emerald-100 rounded-t-xl transition-all relative flex items-end justify-center overflow-hidden">
                  <div
                    className="w-full bg-emerald-600 rounded-t-xl transition-all duration-700 group-hover:bg-emerald-700"
                    style={{ height: `${d.rate}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-400 mt-1">{d.week}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Average Attendance ({overallAttendanceRate}%)</span>
            </span>
            <span className="text-slate-500 font-bold">
              {records.length} total attendance records
            </span>
          </div>
        </div>

        {/* Attendance Distribution Donut / Proportions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Attendance Distribution</h3>
            <p className="text-xs text-slate-500">Breakdown of recorded student statuses</p>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            {/* Visual Ring Gauge */}
            <div className="relative w-36 h-36 rounded-full flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${getStatusPercent(presentCount)}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{getStatusPercent(presentCount)}%</span>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Present</span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Present ({getStatusPercent(presentCount)}%)</span>
                </span>
                <span className="font-bold text-slate-800">{presentCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Late ({getStatusPercent(lateCount)}%)</span>
                </span>
                <span className="font-bold text-slate-800">{lateCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Absent ({getStatusPercent(absentCount)}%)</span>
                </span>
                <span className="font-bold text-slate-800">{absentCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Performance Bars */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Course Performance</h3>
            <p className="text-xs text-slate-500">Attendance comparison across saved courses</p>
          </div>
          <button
            onClick={() => onNavigateTab('reports')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            Generate Semester Report →
          </button>
        </div>

        <div className="space-y-3">
          {coursePerformance.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-500">No courses are available in Firebase yet.</p>
          ) : coursePerformance.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{c.code}</span>
                  <span className="text-slate-500">• {c.name}</span>
                </div>
                <span className="font-black text-slate-900 tabular-nums">{c.rate}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${c.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
