import React, { useEffect, useState } from 'react';
import {
  Radio,
  Plus,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  CheckCircle2,
  StopCircle,
  Eye,
  Search,
  Filter,
  Calendar,
  Printer
} from 'lucide-react';
import { AttendanceRecord, AttendanceSession, User, Course, StudentDetail } from '../types';
import { soundManager } from '../lib/sound';
import { ClassAttendanceSheet } from './ClassAttendanceSheet';
import { printSheet } from '../lib/printSheet';

interface SessionsViewProps {
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  courses: Course[];
  students: StudentDetail[];
  currentUser: User;
  onOpenCreateSession: () => void;
  onSelectSession: (session: AttendanceSession) => void;
  onEndSession: (sessionId: string) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  records,
  courses,
  students,
  currentUser,
  onOpenCreateSession,
  onSelectSession,
  onEndSession
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [printSession, setPrintSession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    if (!printSession) return;
    const timeoutId = window.setTimeout(() => {
      printSheet('printing-class-sheet');
      setPrintSession(null);
    }, 100);
    return () => window.clearTimeout(timeoutId);
  }, [printSession]);

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesSearch =
      s.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Attendance Sessions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time GPS geofenced lecture sessions and check-in audit logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(['all', 'active', 'closed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  filterStatus === st
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              onOpenCreateSession();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSessions.map((session) => {
          const isActive = session.status === 'active';
          const attendeeCount = records.filter((record) => record.sessionId === session.id).length;
          return (
            <div
              key={session.id}
              className={`bg-white rounded-3xl border p-6 shadow-xs flex flex-col justify-between space-y-5 transition-all ${
                isActive
                  ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-md'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700">
                    {session.courseCode}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
                    <span>{isActive ? 'Active Broadcast' : 'Closed'}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 line-clamp-1">
                    {session.courseTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{session.locationName}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Radius</span>
                    <span className="font-bold text-slate-800">{session.radiusMeters}m Geofence</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Attendees</span>
                    <span className="font-bold text-slate-800">{attendeeCount} students</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => onSelectSession(session)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
                <button
                  onClick={() => setPrintSession(session)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Print class attendance sheet"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                {isActive && (
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onEndSession(session.id);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Close Attendance Session"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Close</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {printSession && (
        <ClassAttendanceSheet
          session={printSession}
          course={courses.find((course) => course.id === printSession.courseId)}
          records={records}
          students={students}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
