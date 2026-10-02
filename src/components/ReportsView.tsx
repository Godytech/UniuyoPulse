import React, { useEffect, useState } from 'react';
import {
  FileBarChart,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Calendar,
  BookOpen
} from 'lucide-react';
import { Course, StudentDetail, User } from '../types';
import { soundManager } from '../lib/sound';
import { formatDepartment } from '../lib/formatDepartment';
import { formatFaculty } from '../lib/formatFaculty';
import { printSheet } from '../lib/printSheet';

interface ReportsViewProps {
  courses: Course[];
  students: StudentDetail[];
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ courses, students, currentUser }) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState(courses[0]?.code ?? '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'barred'>('all');

  useEffect(() => {
    if (!courses.some((course) => course.code === selectedCourseCode)) {
      setSelectedCourseCode(courses[0]?.code ?? '');
    }
  }, [courses, selectedCourseCode]);

  // Filter students and their attendance for selected course
  const reportRows = students.map((student) => {
    const courseStats = student.enrolledCourses.find((c) => c.code === selectedCourseCode) || {
      classesHeld: 0,
      present: 0,
      late: 0,
      absent: 0,
      attendanceRate: 0
    };

    const isEligible = courseStats.attendanceRate >= 75;

    return {
      student,
      classesHeld: courseStats.classesHeld,
      present: courseStats.present,
      late: courseStats.late,
      absent: Math.max(0, courseStats.absent),
      attendanceRate: courseStats.attendanceRate,
      isEligible
    };
  });

  const filteredRows = reportRows.filter((r) => {
    if (statusFilter === 'eligible') return r.isEligible;
    if (statusFilter === 'barred') return !r.isEligible;
    return true;
  });

  // Summary Metrics (Section 22)
  const totalStudents = reportRows.length;
  const totalClasses = Math.max(0, ...reportRows.map((row) => row.classesHeld));
  const eligibleCount = reportRows.filter((r) => r.isEligible).length;
  const barredCount = totalStudents - eligibleCount;
  const averageAttendance = totalStudents
    ? Math.round(reportRows.reduce((acc, curr) => acc + curr.attendanceRate, 0) / totalStudents)
    : 0;
  const thresholdDifference = averageAttendance - 75;
  const selectedCourse = courses.find((course) => course.code === selectedCourseCode);

  const handlePrint = () => {
    soundManager.playClick();
    printSheet('printing-semester-report', true);
  };

  return (
    <div className="semester-report-view space-y-6">
      {/* Header & Generator Filter Bar (Sections 21-22) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Semester Attendance Report Generator
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Official university examination eligibility & attendance compliance audit
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Use Print / Save PDF to create an official read-only copy of the generated report.
              </span>
            </div>
          </div>

          {/* Export & Print CTAs */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Generator Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Course</label>
            <select
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'eligible' | 'barred')}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Students ({totalStudents})</option>
              <option value="eligible">Exam Eligible (≥75%)</option>
              <option value="barred">Barred / At Risk (&lt;75%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUMMARY METRIC CARDS (Section 22) */}
      <div className="semester-report-metrics grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Students</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums block mt-1">{totalStudents}</span>
          <span className="text-[10px] text-slate-400">Enrolled in class</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Classes</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums block mt-1">{totalClasses}</span>
          <span className="text-[10px] text-slate-400">Held this semester</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Average Attendance</span>
          <span className="text-2xl font-black text-indigo-600 tabular-nums block mt-1">{averageAttendance}%</span>
          <span className={`text-[10px] font-bold ${thresholdDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {thresholdDifference >= 0 ? `${thresholdDifference} percentage points above` : `${Math.abs(thresholdDifference)} percentage points below`} threshold
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">Eligible (≥75%)</span>
          <span className="text-2xl font-black text-emerald-600 tabular-nums block mt-1">{eligibleCount}</span>
          <span className="text-[10px] text-emerald-600 font-semibold">Cleared for exams</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-rose-700 uppercase">At Risk / Barred (&lt;75%)</span>
          <span className="text-2xl font-black text-rose-600 tabular-nums block mt-1">{barredCount}</span>
          <span className="text-[10px] text-rose-600 font-semibold">Under threshold</span>
        </div>
      </div>

      {/* PRINTABLE ACADEMIC LETTERHEAD & REPORT TABLE (Sections 21-23) */}
      <div className="semester-report-print bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Letterhead Header for Print / Audit */}
        <div className="semester-report-header p-6 sm:p-8 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
          <img className="semester-report-logo" src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo crest" />
          <div className="semester-report-brand">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="semester-report-university">University of Uyo</span>
              <span className="semester-report-audit px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                OFFICIAL AUDIT
              </span>
            </div>
            <h3 className="semester-report-department">
              {formatDepartment(currentUser.department)}
            </h3>
            <p className="semester-report-faculty">{formatFaculty(currentUser.faculty)}</p>
            <p className="semester-report-title">Semester Reports &amp; Analytics</p>
          </div>

          <div className="semester-report-header-content flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="semester-report-course text-xs text-slate-600 mt-0.5">
              Attendance Sheet for <span className="font-bold text-indigo-700">{selectedCourseCode || 'all courses'}</span>
            </p>
            <div className="semester-report-meta text-xs text-slate-500 text-center sm:text-right font-mono bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div>Required Threshold: <strong>75%</strong></div>
              <div>Date Generated: <strong>{new Date().toLocaleDateString()}</strong></div>
              <div>System: <strong>Uniuyo Pulse GPS Geofence Engine</strong></div>
            </div>
          </div>
        </div>

        {/* Semester Attendance Table (Section 23) */}
        <div className="sheet-table-scroll semester-report-table-wrap overflow-x-auto">
          <p className="sheet-scroll-hint" aria-hidden="true">Swipe horizontally to view all report columns</p>
          <table className="semester-report-table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">Student Name</th>
                <th className="py-3.5 px-6">Student Reg No</th>
                <th className="py-3.5 px-4 text-center">Total Held</th>
                <th className="py-3.5 px-4 text-center">Present</th>
                <th className="py-3.5 px-4 text-center">Late</th>
                <th className="py-3.5 px-4 text-center">Absent</th>
                <th className="py-3.5 px-6">Attendance Rate</th>
                <th className="py-3.5 px-6 text-right">Exam Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                    No attendance records are available for this course yet.
                  </td>
                </tr>
              ) : filteredRows.map(({ student, classesHeld, present, late, absent, attendanceRate, isEligible }) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-6 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <img src={student.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                      <span>{student.fullName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 font-mono font-bold text-slate-600">
                    {student.studentId}
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-700">{classesHeld}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-700">{present}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-amber-700">{late}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-rose-700">{absent}</td>
                  <td className="py-3.5 px-6 min-w-[120px]">
                    <div className="space-y-1">
                      <span className="font-black text-slate-900 tabular-nums">{attendanceRate}%</span>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isEligible ? 'bg-indigo-600' : 'bg-rose-500'}`}
                          style={{ width: `${attendanceRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                        isEligible
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isEligible ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Exam Eligible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Barred from Exam</span>
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Academic Sign-off Section for Printing / Official Records */}
        <div className="semester-report-signatures p-8 border-t border-slate-200 bg-slate-50/50 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-8 text-xs text-slate-600">
          <div className="space-y-6">
            <p className="font-bold text-slate-800 uppercase text-[10px]">
              Prepared By ({
                currentUser.role === 'rep_admin' || currentUser.role === 'course_rep_admin'
                  ? 'Course Rep Admin'
                  : currentUser.role === 'assistant_course_rep'
                    ? 'Assistant Course Rep'
                    : currentUser.role
              })
            </p>
            <div className="border-b border-slate-300 h-8" />
            <p className="font-mono text-[11px]">{currentUser.fullName} ({currentUser.studentId || currentUser.email})</p>
          </div>

          <div className="space-y-6">
            <p className="font-bold text-slate-800 uppercase text-[10px]">Verified By (Course Lecturer)</p>
            <div className="border-b border-slate-300 h-8" />
            <p className="font-mono text-[11px]"> </p>
          </div>

          <div className="space-y-6">
            <p className="font-bold text-slate-800 uppercase text-[10px]">Approved By (Head of Department)</p>
            <div className="border-b border-slate-300 h-8" />
            <p className="font-mono text-[11px]"> </p>
          </div>
        </div>
      </div>
    </div>
  );
};
