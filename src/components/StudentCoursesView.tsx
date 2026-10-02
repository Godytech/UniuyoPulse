import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';
import { Course, AttendanceRecord, User as UserType } from '../types';
import { soundManager } from '../lib/sound';

interface StudentCoursesViewProps {
  currentUser: UserType;
  courses: Course[];
  records: AttendanceRecord[];
  onSelectCourse?: (course: Course) => void;
}

export const StudentCoursesView: React.FC<StudentCoursesViewProps> = ({
  currentUser,
  courses,
  records,
  onSelectCourse
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const semesters = Array.from(new Map(
    courses.map((course) => [
      course.semesterId ?? 'legacy',
      course.semesterName || 'Current Semester'
    ])
  ).entries());
  const semesterCourses = selectedSemester === 'all'
    ? courses
    : courses.filter((course) => (course.semesterId ?? 'legacy') === selectedSemester);

  // Course statistics calculation for current student
  const coursesWithStats = semesterCourses.map((course) => {
    const courseRecords = records.filter(
      (r) => r.courseId === course.id && r.studentId === currentUser.id
    );

    return {
      ...course,
      recordCount: courseRecords.length,
      presentCount: courseRecords.filter((r) => r.status === 'present').length,
      lateCount: courseRecords.filter((r) => r.status === 'late').length,
      absentCount: courseRecords.filter((r) => r.status === 'absent').length
    };
  });

  const filteredCourses = coursesWithStats.filter(
    (c) =>
      c.code.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Department Courses
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {currentUser.department}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {semesters.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Semester
              <select
                value={selectedSemester}
                onChange={(event) => setSelectedSemester(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
              >
                <option value="all">All semesters</option>
                {semesters.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by code or title..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center text-sm text-slate-500">
          No courses found for this semester and search.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCourses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-5"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700">
                  {course.code}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{course.title}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Course Rep: {course.repName || 'Not assigned'}</span>
                  <span>•</span>
                  <span>{course.level}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{course.classroom}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{course.scheduleDay} · {course.scheduleTime}</span>
                </span>
              </div>
            </div>

            {/* Attendance Metrics Bar */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              {/* Attendance Mini Counters */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Records</span>
                  <span className="font-bold text-slate-800 text-xs">{course.recordCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 block uppercase">Present</span>
                  <span className="font-bold text-emerald-800 text-xs">{course.presentCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase">Late</span>
                  <span className="font-bold text-amber-800 text-xs">{course.lateCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-700 block uppercase">Absent</span>
                  <span className="font-bold text-rose-800 text-xs">{course.absentCount}</span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-2">
              <button
                onClick={() => {
                  soundManager.playClick();
                  if (onSelectCourse) onSelectCourse(course);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View Full Attendance History</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
