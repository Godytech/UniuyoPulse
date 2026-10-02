import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  ShieldCheck,
  ExternalLink,
  Printer,
  Calendar
} from 'lucide-react';
import { AttendanceRecord, Course, User } from '../types';
import { soundManager } from '../lib/sound';
import { formatDepartment } from '../lib/formatDepartment';
import { formatFaculty } from '../lib/formatFaculty';
import { printSheet } from '../lib/printSheet';

interface RecordsViewProps {
  records: AttendanceRecord[];
  courses: Course[];
  currentUser: User;
  onViewSlip: (record: AttendanceRecord) => void;
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  records,
  courses,
  currentUser,
  onViewSlip
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter records
  const filteredRecords = records.filter((r) => {
    // If student, restrict to their own records; if rep/admin, show all
    if (currentUser.role === 'student' && r.studentId !== currentUser.id) {
      return false;
    }

    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentRegNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.courseCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCourse = courseFilter === 'all' || r.courseCode === courseFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  const handlePrint = () => {
    soundManager.playClick();
    printSheet('printing-attendance-records', true);
  };
  const selectedCourse = courses.find((course) => course.code === courseFilter);

  return (
    <div className="records-view space-y-6">
      {/* Header & Controls */}
      <div className="records-controls bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Attendance Records & Audit Log
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Attendance entries are append-only. Session hosts are identified separately from GPS check-ins.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Use Print / Save PDF to create a read-only review copy of the filtered audit log.
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or code..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#008751] hover:bg-[#006B3F] text-white text-xs font-bold transition-colors cursor-pointer print:hidden"
            title="Print or save the filtered attendance audit log as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="records-print bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <header className="records-print-header">
          <img className="records-print-logo" src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo crest" />
          <h1>UNIVERSITY OF UYO</h1>
          <p className="records-print-department">{formatDepartment(currentUser.department)}</p>
          <p className="records-print-faculty">{formatFaculty(currentUser.faculty)}</p>
          <h2>Attendance Records &amp; Audit Log</h2>
          <div className="records-print-meta">
            <p>
              Course: <strong>{courseFilter === 'all' ? 'All Courses' : courseFilter}</strong>
              {selectedCourse && ` — ${selectedCourse.title}`}
            </p>
            <p>Status: <strong>{statusFilter === 'all' ? 'All Statuses' : statusFilter}</strong></p>
            <p>Date Generated: <strong>{new Date().toLocaleDateString('en-GB')}</strong></p>
            <p>System: <strong>Uniuyo Pulse GPS Geofence Engine</strong></p>
          </div>
        </header>
        <div className="sheet-table-scroll records-print-table-wrap overflow-x-auto">
          <p className="sheet-scroll-hint" aria-hidden="true">Swipe horizontally to view all record columns</p>
          <table className="records-print-table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">Student</th>
                <th className="py-3.5 px-6">Course</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6">Distance & Accuracy</th>
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6 text-right">Verification Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No attendance records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      <div>{rec.studentName}</div>
                      <span className="text-[11px] font-mono text-slate-400">{rec.studentRegNo}</span>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="font-bold text-slate-800">{rec.courseCode}</span>
                      <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{rec.courseTitle}</p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                          rec.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'late'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {rec.distanceFromClassMeters > 0 ? (
                        <div>
                          <span className="font-bold text-slate-800">{rec.distanceFromClassMeters}m</span>
                          <span className="text-[10px] text-slate-400 ml-1">(±{rec.locationAccuracyMeters}m GPS)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 font-mono text-[11px]">
                      {new Date(rec.submittedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onViewSlip(rec);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-extrabold text-xs transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="records-print-signatures">
          <section>
            <h3>PREPARED BY (COURSE REP ADMIN)</h3>
            <div />
            <p>{currentUser.fullName} ({currentUser.studentId || currentUser.email})</p>
          </section>
          <section>
            <h3>VERIFIED BY (COURSE LECTURER)</h3>
            <div />
            <p>Signature &amp; Date</p>
          </section>
          <section>
            <h3>APPROVED BY (HEAD OF DEPARTMENT)</h3>
            <div />
            <p>Signature &amp; Date</p>
          </section>
        </footer>
      </div>
    </div>
  );
};
