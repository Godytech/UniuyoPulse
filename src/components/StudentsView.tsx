import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  GraduationCap,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { StudentDetail } from '../types';
import type { CourseRepRole } from '../types';
import { soundManager } from '../lib/sound';
import { getInitials } from '../lib/avatar';
import { StudentDetailModal } from './StudentDetailModal';

interface StudentsViewProps {
  students: StudentDetail[];
  canAssignRoles: boolean;
  onAssignRole: (student: StudentDetail, role: CourseRepRole | 'student') => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  canAssignRoles,
  onAssignRole
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Good Standing' | 'Warning' | 'Critical'>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Student Attendance Directory
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Student profiles loaded from Firebase
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or reg no..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(['all', 'Good Standing', 'Warning', 'Critical'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Students Table (Section 19) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Student</th>
                <th className="py-4 px-6">Student ID</th>
                <th className="py-4 px-6">Department & Level</th>
                <th className="py-4 px-6 text-center">Courses</th>
                <th className="py-4 px-6">Attendance %</th>
                <th className="py-4 px-6 text-center">Status</th>
                {canAssignRoles && <th className="py-4 px-6">Course Rep Role</th>}
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={canAssignRoles ? 8 : 7} className="py-12 text-center text-slate-400">
                    No students match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedStudent(student);
                    }}
                  >
                    {/* Avatar & Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span
                          aria-label={student.fullName}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008751] text-xs font-black text-white ring-1 ring-[#008751]/20"
                        >
                          {getInitials(student.fullName)}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{student.fullName}</p>
                          <p className="text-[11px] text-slate-400">{student.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Reg No */}
                    <td className="py-4 px-6 font-mono font-bold text-slate-700">
                      {student.studentId}
                    </td>

                    {/* Department & Level */}
                    <td className="py-4 px-6 text-slate-600">
                      <div>{student.department}</div>
                      <span className="text-[11px] text-slate-400">{student.level}</span>
                    </td>

                    {/* Courses Count */}
                    <td className="py-4 px-6 text-center font-bold text-slate-700">
                      {student.enrolledCourses.length}
                    </td>

                    {/* Attendance % with Mini Bar */}
                    <td className="py-4 px-6 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-slate-900 tabular-nums">
                            {student.attendanceRate}%
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {student.presentCount}/{student.presentCount + student.lateCount + student.absentCount} classes
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              student.attendanceRate >= 75 ? 'bg-indigo-600' : 'bg-rose-500'
                            }`}
                            style={{ width: `${student.attendanceRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          student.status === 'Good Standing'
                            ? 'bg-emerald-100 text-emerald-800'
                            : student.status === 'Warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>

                    {canAssignRoles && (
                      <td className="py-4 px-6">
                        <select
                          aria-label={`Assign role to ${student.fullName}`}
                          value={student.role ?? 'student'}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            const role = event.target.value;
                            if (
                              role === 'student' ||
                              role === 'course_rep_admin' ||
                              role === 'assistant_course_rep'
                            ) {
                              onAssignRole(student, role);
                            }
                          }}
                          className="min-w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="student">Student</option>
                          <option value="course_rep_admin">Course Rep Admin</option>
                          <option value="assistant_course_rep">Assistant Course Rep</option>
                          {student.role === 'rep_admin' && (
                            <option value="rep_admin" disabled>Legacy Course Rep Admin</option>
                          )}
                        </select>
                      </td>
                    )}

                    {/* Action Button */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundManager.playClick();
                          setSelectedStudent(student);
                        }}
                        className="student-directory-view-button px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-extrabold text-xs transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Student</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal (Section 20) */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};
