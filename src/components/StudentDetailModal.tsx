import React from 'react';
import {
  X,
  Mail,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpen,
  Award,
  ShieldCheck,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { StudentDetail } from '../types';
import { soundManager } from '../lib/sound';
import { getInitials } from '../lib/avatar';

interface StudentDetailModalProps {
  student: StudentDetail;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose
}) => {
  const isEligible = student.attendanceRate >= 75;

  return (
    <div className="student-detail-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="student-detail-panel bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="student-detail-header px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-slate-900">Student Profile & Academic Attendance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* SECTION 20: Profile Card */}
          <div className="student-detail-identity flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-emerald-50/30 border border-slate-200/80">
            <span
              aria-label={student.fullName}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#008751] text-lg font-black text-white ring-2 ring-[#008751]/20 shadow-sm"
            >
              {getInitials(student.fullName)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-black text-slate-900">{student.fullName}</h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    student.status === 'Good Standing'
                        ? 'student-detail-status-good bg-emerald-100 text-emerald-800'
                      : student.status === 'Warning'
                        ? 'student-detail-status-warning bg-amber-100 text-amber-800'
                        : 'student-detail-status-alert bg-rose-100 text-rose-800'
                  }`}
                >
                  {student.status}
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                {student.studentId}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{student.email}</span>
                </span>
                <span>•</span>
                <span>{student.department} ({student.level})</span>
              </div>
            </div>
          </div>

          {/* Attendance Overview (4 Stat Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="student-detail-stat-overall p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Rate</span>
              <span className={`text-2xl font-black tabular-nums mt-1 block ${isEligible ? 'text-emerald-600' : 'text-rose-600'}`}>
                {student.attendanceRate}%
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {isEligible ? 'Exam Eligible' : 'Below 75% Requirement'}
              </span>
            </div>
            <div className="student-detail-stat-present p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Present</span>
              <span className="text-2xl font-black text-emerald-900 tabular-nums mt-1 block">
                {student.presentCount}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600">Classes verified</span>
            </div>
            <div className="student-detail-stat-late p-4 rounded-2xl bg-amber-50/50 border border-amber-100 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Late</span>
              <span className="text-2xl font-black text-amber-900 tabular-nums mt-1 block">
                {student.lateCount}
              </span>
              <span className="text-[10px] font-semibold text-amber-600">Grace period</span>
            </div>
            <div className="student-detail-stat-absent p-4 rounded-2xl bg-rose-50/50 border border-rose-100 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Absent</span>
              <span className="text-2xl font-black text-rose-900 tabular-nums mt-1 block">
                {student.absentCount}
              </span>
              <span className="text-[10px] font-semibold text-rose-600">Unexcused</span>
            </div>
          </div>

          {/* Enrolled Courses Breakdown Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Enrolled Courses & Standing
              </h5>
              <span className="text-xs text-slate-400">Attendance records by course</span>
            </div>

            <div className="student-detail-course-list border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {student.enrolledCourses.map((c) => (
                <div key={c.courseId} className="student-detail-course-row p-4 bg-white hover:bg-slate-50 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="student-detail-course-code px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-700">
                        {c.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{c.title}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900 tabular-nums">{c.attendanceRate}%</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="student-detail-progress-track w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        c.attendanceRate >= 75 ? 'bg-emerald-600' : 'bg-rose-500'
                      }`}
                      style={{ width: `${c.attendanceRate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {c.classesHeld} classes: <strong className="text-emerald-700">{c.present} present</strong>, <strong className="text-amber-700">{c.late} late</strong>, <strong className="text-rose-700">{c.absent} absent</strong>
                    </span>
                    <span className={c.attendanceRate >= 75 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                      {c.attendanceRate >= 75 ? 'Cleared for Examination' : 'Barred from Examination'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="student-detail-footer px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="student-detail-close px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
