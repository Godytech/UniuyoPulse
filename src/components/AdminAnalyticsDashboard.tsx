import React, { useState } from 'react';
import {
  ShieldCheck,
  Radio,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Search,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
  QrCode,
  StopCircle
} from 'lucide-react';
import { AttendanceSession, AttendanceRecord, Course, User, ThemeMode } from '../types';
import { soundManager } from '../lib/sound';

export interface AdminAnalyticsDashboardProps {
  user: User;
  courses: Course[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  onStartSession: (session: AttendanceSession) => void;
  onEndSession: (sessionId: string) => void;
  onExtendSession: (sessionId: string, minutes: number) => void;
  onOpenCreateModal: () => void;
  onViewSlip?: (record: AttendanceRecord) => void;
  themeMode: ThemeMode;
}

export type XAdminAnalyticsDashboardProps = AdminAnalyticsDashboardProps;

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  user,
  courses,
  sessions,
  records,
  onEndSession,
  onExtendSession,
  onOpenCreateModal,
  onViewSlip,
  themeMode
}) => {
  const isDark = themeMode === 'lights_out';
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPinSessionId, setCopiedPinSessionId] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const totalRecords = records.length;
  const verifiedPresent = records.filter((r) => r.status === 'present').length;
  const complianceRate = totalRecords > 0 ? ((verifiedPresent / totalRecords) * 100).toFixed(1) : '100';

  const filteredRecords = records.filter((r) => {
    if (selectedCourseFilter !== 'all' && r.courseCode !== selectedCourseFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentRegNo.toLowerCase().includes(q) ||
        r.courseCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyPin = (sessionId: string, pin: string) => {
    soundManager.playClick();
    navigator.clipboard?.writeText(pin);
    setCopiedPinSessionId(sessionId);
    setTimeout(() => setCopiedPinSessionId(null), 2000);
  };

  const handleExportCSV = () => {
    soundManager.playClick();
    const headers =
      'ID,Course,Student Name,Reg No,Status,Distance (m),Accuracy (m),Submitted At,Device Fingerprint\n';
    const rows = filteredRecords
      .map(
        (r) =>
          `"${r.id}","${r.courseCode}","${r.studentName}","${r.studentRegNo}","${r.status}","${r.distanceFromClassMeters.toFixed(1)}","${r.locationAccuracyMeters.toFixed(1)}","${r.submittedAt}","${r.deviceFingerprint}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      {/* Top Sticky Header */}
      <div
        className={`sticky top-0 z-20 backdrop-blur-md px-4 py-3 border-b flex items-center justify-between gap-2 ${
          isDark ? 'bg-black/85 border-[#2F3336]' : 'bg-white/85 border-[#EFF3F4]'
        }`}
      >
        <div>
          <div className="flex items-center gap-1.5">
            <h2
              className={`font-black text-lg sm:text-xl tracking-tight ${
                isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              }`}
            >
              Rep Console & Analytics
            </h2>
            <span className="w-4 h-4 rounded-full bg-[#1D9BF0] text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5" />
            </span>
          </div>
          <span className="text-xs text-[#71767B] font-mono">
            Department of Computer Science · Course Rep Control
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenCreateModal();
            }}
            className="py-1.5 px-3.5 bg-[#1D9BF0] hover:bg-[#1A8CD8] active:scale-98 text-white font-black text-xs rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open Session</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="Export CSV Audit"
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#2F3336] hover:bg-[#16181C] text-[#E7E9EA]'
                : 'border-[#EFF3F4] hover:bg-[#EFF3F4] text-[#0F1419]'
            }`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Analytics KPI Overview */}
      <div className={`p-4 border-b ${isDark ? 'border-[#2F3336]' : 'border-[#EFF3F4]'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
            }`}
          >
            <span className="text-[11px] font-mono font-bold text-[#71767B] uppercase block">
              Active Broadcasts
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-2xl font-black tracking-tight tabular-nums ${
                  activeSessions.length > 0
                    ? 'text-[#1D9BF0]'
                    : isDark
                    ? 'text-[#E7E9EA]'
                    : 'text-[#0F1419]'
                }`}
              >
                {activeSessions.length}
              </span>
              <span className="text-[10px] text-[#00BA7C] font-mono font-bold">LIVE</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
            }`}
          >
            <span className="text-[11px] font-mono font-bold text-[#71767B] uppercase block">
              Total Check-Ins
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-2xl font-black tracking-tight tabular-nums ${
                  isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                }`}
              >
                {totalRecords}
              </span>
              <span className="text-[10px] text-[#71767B] font-mono">Logged</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
            }`}
          >
            <span className="text-[11px] font-mono font-bold text-[#71767B] uppercase block">
              Verified Compliance
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black tracking-tight text-[#00BA7C] tabular-nums">
                {complianceRate}%
              </span>
              <span className="text-[10px] text-[#00BA7C] font-mono">Inside</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
            }`}
          >
            <span className="text-[11px] font-mono font-bold text-[#71767B] uppercase block">
              Security Anomaly
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black tracking-tight text-[#1D9BF0] tabular-nums">
                0
              </span>
              <span className="text-[10px] text-[#00BA7C] font-mono font-bold">Passed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Broadcasts Live Controls Strip */}
      {activeSessions.length > 0 && (
        <div className={`p-4 border-b ${isDark ? 'border-[#2F3336]' : 'border-[#EFF3F4]'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3
              className={`text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#1D9BF0] animate-pulse" />
              <span>Live Attendance Broadcasts ({activeSessions.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {activeSessions.map((session) => {
              const sessionAttendees = records.filter((r) => r.sessionId === session.id);
              const remainingMinutes = Math.max(
                1,
                Math.round((new Date(session.endTime).getTime() - Date.now()) / 60000)
              );

              return (
                <div
                  key={session.id}
                  className={`p-3.5 rounded-xl border ${
                    isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-[#1D9BF0]">
                        {session.courseCode} · {session.radiusMeters}m Geofence
                      </span>
                      <h4
                        className={`text-sm font-black ${isDark ? 'text-white' : 'text-black'}`}
                      >
                        {session.courseTitle}
                      </h4>
                      <div className="flex items-center gap-1 text-xs text-[#71767B] mt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#1D9BF0]" />
                        <span>{session.locationName}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-[#FFD400]">
                        {remainingMinutes}m remaining
                      </span>
                      <span className="text-[11px] text-[#71767B] block">
                        {sessionAttendees.length} of {session.maxStudents} signed in
                      </span>
                    </div>
                  </div>

                  {/* Chalkboard PIN pill if enabled */}
                  {session.accessCode && (
                    <div className="mt-2.5 p-2 rounded-lg bg-[#000000]/40 border border-[#2F3336]/40 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-[#71767B]">
                        Chalkboard Security PIN:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-xs font-black text-[#00BA7C] tracking-wider">
                          {session.accessCode}
                        </span>
                        <button
                          onClick={() => handleCopyPin(session.id, session.accessCode!)}
                          className="p-1 text-[#71767B] hover:text-white transition-colors cursor-pointer"
                          title="Copy PIN"
                        >
                          {copiedPinSessionId === session.id ? (
                            <Check className="w-3.5 h-3.5 text-[#00BA7C]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions: Extend +5m, Extend +15m, End Broadcast */}
                  <div className="mt-3 pt-2.5 border-t border-[#2F3336]/40 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onExtendSession(session.id, 5);
                        }}
                        className="py-1 px-2.5 rounded-lg border border-[#2F3336] hover:bg-[#202327] text-[11px] font-mono text-[#71767B] hover:text-white transition-colors cursor-pointer"
                      >
                        +5 Mins
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onExtendSession(session.id, 15);
                        }}
                        className="py-1 px-2.5 rounded-lg border border-[#2F3336] hover:bg-[#202327] text-[11px] font-mono text-[#71767B] hover:text-white transition-colors cursor-pointer"
                      >
                        +15 Mins
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        soundManager.playWarning();
                        onEndSession(session.id);
                      }}
                      className="py-1 px-3 rounded-full bg-[#F4212E]/15 hover:bg-[#F4212E]/25 text-[#F4212E] border border-[#F4212E]/30 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Close Attendance</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real-time Attendance Roster Table */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3
            className={`font-black text-sm uppercase tracking-wider ${
              isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
            }`}
          >
            Verified Student Roster ({filteredRecords.length})
          </h3>

          <div className="flex items-center gap-2">
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className={`text-xs font-mono font-bold py-1.5 px-2.5 rounded-xl border outline-none cursor-pointer ${
                isDark
                  ? 'bg-[#16181C] border-[#2F3336] text-[#E7E9EA]'
                  : 'bg-[#F7F9F9] border-[#EFF3F4] text-[#0F1419]'
              }`}
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#71767B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name or matriculation number"
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none border ${
              isDark
                ? 'bg-[#16181C] border-[#2F3336] text-white'
                : 'bg-[#F7F9F9] border-[#EFF3F4] text-black'
            }`}
          />
        </div>

        {/* Roster List */}
        <div className="space-y-1.5">
          {filteredRecords.map((record) => {
            const dateObj = new Date(record.submittedAt);
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={record.id}
                onClick={() => {
                  if (onViewSlip) {
                    soundManager.playClick();
                    onViewSlip(record);
                  }
                }}
                className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                  isDark
                    ? 'bg-[#16181C] border-[#2F3336] hover:border-[#1D9BF0]'
                    : 'bg-[#F7F9F9] border-[#EFF3F4] hover:border-[#1D9BF0]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1D9BF0]/15 text-[#1D9BF0] font-black text-xs flex items-center justify-center shrink-0">
                    {record.studentName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
                        {record.studentName}
                      </span>
                      <span className="text-[10px] font-mono text-[#1D9BF0]">
                        {record.courseCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#71767B] font-mono block">
                      {record.studentRegNo} · {timeStr}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right font-mono text-[11px]">
                    <span className="text-[#00BA7C] font-bold block">
                      {record.distanceFromClassMeters.toFixed(1)}m away
                    </span>
                    <span className="text-[#71767B]">±{record.locationAccuracyMeters.toFixed(1)}m</span>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00BA7C]/15 text-[#00BA7C] border border-[#00BA7C]/30">
                    VERIFIED
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const XAdminAnalyticsDashboard = AdminAnalyticsDashboard;
