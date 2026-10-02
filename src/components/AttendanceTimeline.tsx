import React, { useState } from 'react';
import {
  Clock,
  Check,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Filter,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Sparkles,
  Download,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { AttendanceRecord, Course, ThemeMode } from '../types';
import { soundManager } from '../lib/sound';

export interface AttendanceTimelineProps {
  records: AttendanceRecord[];
  courses: Course[];
  themeMode: ThemeMode;
  onViewSlip?: (record: AttendanceRecord) => void;
}

export type XAttendanceTimelineProps = AttendanceTimelineProps;

export const AttendanceTimeline: React.FC<AttendanceTimelineProps> = ({
  records,
  courses,
  themeMode,
  onViewSlip
}) => {
  const isDark = themeMode === 'lights_out';
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const filteredRecords = records.filter((r) => {
    if (selectedCourseFilter !== 'all' && r.courseCode !== selectedCourseFilter) return false;
    if (selectedStatusFilter !== 'all' && r.status !== selectedStatusFilter) return false;
    return true;
  });

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const complianceRate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 100;

  const handleExportCSV = () => {
    soundManager.playClick();
    const headers = 'ID,Course Code,Course Title,Student Reg,Status,Distance (m),Accuracy (m),Timestamp,Fingerprint\n';
    const rows = filteredRecords
      .map(
        (r) =>
          `"${r.id}","${r.courseCode}","${r.courseTitle}","${r.studentRegNo}","${r.status}","${r.distanceFromClassMeters.toFixed(1)}","${r.locationAccuracyMeters.toFixed(1)}","${r.submittedAt}","${r.deviceFingerprint}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      {/* Sticky Header / Filter Bar */}
      <div
        className={`sticky top-0 z-20 backdrop-blur-md px-4 py-3 border-b flex items-center justify-between gap-2 ${
          isDark ? 'bg-black/85 border-[#2F3336]' : 'bg-white/85 border-[#EFF3F4]'
        }`}
      >
        <div>
          <h2
            className={`font-black text-lg sm:text-xl tracking-tight ${
              isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
            }`}
          >
            Attendance Timeline
          </h2>
          <span className="text-xs text-[#71767B] font-mono">
            {filteredRecords.length} verified records · {complianceRate}% compliance
          </span>
        </div>

        {/* Quick Filter Selectors & Export */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className={`text-xs font-mono font-bold py-1.5 px-2 rounded-full border outline-none cursor-pointer ${
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

          <button
            onClick={handleExportCSV}
            title="Download CSV Transcript"
            className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#2F3336] hover:bg-[#16181C] text-[#E7E9EA]'
                : 'border-[#EFF3F4] hover:bg-[#EFF3F4] text-[#0F1419]'
            }`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div
        className={`p-3.5 border-b grid grid-cols-3 gap-2 text-center text-xs font-mono ${
          isDark ? 'border-[#2F3336] bg-[#16181C]/30' : 'border-[#EFF3F4] bg-[#F7F9F9]'
        }`}
      >
        <div>
          <span className="text-[#71767B] text-[10px] uppercase block">Compliance</span>
          <span className="text-base font-black text-[#00BA7C]">{complianceRate}%</span>
        </div>
        <div>
          <span className="text-[#71767B] text-[10px] uppercase block">Verified Present</span>
          <span className={`text-base font-black ${isDark ? 'text-white' : 'text-black'}`}>
            {presentCount}
          </span>
        </div>
        <div>
          <span className="text-[#71767B] text-[10px] uppercase block">Late Arrivals</span>
          <span className="text-base font-black text-[#FFD400]">{lateCount}</span>
        </div>
      </div>

      {/* Timeline Feed */}
      {filteredRecords.length === 0 ? (
        <div className="py-16 px-6 text-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 stroke-[1.8px]" />
          </div>
          <h3
            className={`text-xl font-black tracking-tight ${
              isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
            }`}
          >
            Nothing here yet
          </h3>
          <p className="text-sm text-[#71767B] mt-1.5 leading-relaxed">
            You don’t have any attendance records matching this filter. Once you check into a lecture via
            GPS, it’ll show up right here in your timeline.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#2F3336]/60">
          {filteredRecords.map((record) => {
            const dateObj = new Date(record.submittedAt);
            const timeFormatted = dateObj.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });
            const dateFormatted = dateObj.toLocaleDateString([], {
              month: 'short',
              day: 'numeric'
            });

            const isPresent = record.status === 'present';
            const isLate = record.status === 'late';

            return (
              <article
                key={record.id}
                onClick={() => {
                  if (onViewSlip) {
                    soundManager.playClick();
                    onViewSlip(record);
                  }
                }}
                className={`p-4 transition-colors cursor-pointer group ${
                  isDark ? 'hover:bg-[#16181C]/40' : 'hover:bg-[#F7F9F9]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Left Avatar / Course Icon */}
                  <div className="w-10 h-10 rounded-full bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 text-[#1D9BF0] font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {record.courseCode.split(' ')[0]}
                  </div>

                  {/* Main Content Card */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-black text-sm truncate ${
                            isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                          }`}
                        >
                          {record.courseTitle}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full bg-[#00BA7C] text-white flex items-center justify-center shrink-0"
                          title="Verified geofence"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </span>
                        <span className="text-xs text-[#71767B] font-mono">
                          @{record.courseCode.toLowerCase().replace(' ', '')}
                        </span>
                      </div>

                      <span className="text-xs text-[#71767B] font-mono shrink-0">
                        {dateFormatted} · {timeFormatted}
                      </span>
                    </div>

                    {/* Geofence Telemetry Body */}
                    <div className="mt-2 text-xs leading-relaxed space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold inline-flex items-center gap-1 ${
                            isPresent
                              ? 'bg-[#00BA7C]/15 text-[#00BA7C] border border-[#00BA7C]/30'
                              : isLate
                              ? 'bg-[#FFD400]/15 text-[#FFD400] border border-[#FFD400]/30'
                              : 'bg-[#F4212E]/15 text-[#F4212E] border border-[#F4212E]/30'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {isPresent ? 'Verified Present' : isLate ? 'Late Arrival' : 'Absent'}
                        </span>

                        {/* Distance Badge */}
                        <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#1D9BF0]/15 text-[#1D9BF0] border border-[#1D9BF0]/30 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {record.distanceFromClassMeters.toFixed(1)}m from center
                        </span>

                        {/* Accuracy */}
                        <span className="text-[11px] text-[#71767B] font-mono">
                          (±{record.locationAccuracyMeters.toFixed(1)}m GPS accuracy)
                        </span>
                      </div>

                      {/* Device Fingerprint Proof & Slip Trigger */}
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-[#71767B]">
                        <span className="truncate">Student: {record.studentRegNo}</span>
                        <span className="text-[#1D9BF0] group-hover:underline flex items-center gap-1">
                          <QrCode className="w-3 h-3" />
                          <span>View Official Slip →</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const XAttendanceTimeline = AttendanceTimeline;
