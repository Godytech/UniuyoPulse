import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Radio,
  BookOpen
} from 'lucide-react';
import { TimetableEntry, Course, AttendanceSession, User } from '../types';
import { soundManager } from '../lib/sound';
import { TimetableManagementView } from './TimetableManagementView';

interface CalendarViewProps {
  timetable: TimetableEntry[];
  managementTimetable: TimetableEntry[];
  courses: Course[];
  activeSessions: AttendanceSession[];
  currentUser: User;
  canManageTimetables: boolean;
  onSaveTimetable: (
    semesterId: string,
    semesterName: string,
    entries: TimetableEntry[]
  ) => Promise<void>;
  onOpenCheckIn?: (session: AttendanceSession) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  timetable,
  managementTimetable,
  courses,
  activeSessions,
  currentUser,
  canManageTimetables,
  onSaveTimetable,
  onOpenCheckIn
}) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const semesters = Array.from(new Map(
    timetable.map((entry) => [
      entry.semesterId ?? 'legacy',
      entry.semesterName || 'Current Semester'
    ])
  ).entries());
  const visibleTimetable = selectedSemester === 'all'
    ? timetable
    : timetable.filter((entry) => (entry.semesterId ?? 'legacy') === selectedSemester);

  const classesForDay = visibleTimetable.filter((t) => t.day === selectedDay);

  return (
    <div className="w-full min-w-0 space-y-6">
      {canManageTimetables && (
        <TimetableManagementView
          currentUser={currentUser}
          timetable={managementTimetable}
          onSave={onSaveTimetable}
        />
      )}

      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Academic Timetable & Schedule
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Your saved timetable and active attendance sessions
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
          <div className="grid w-full grid-cols-5 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 sm:flex sm:w-auto sm:items-center">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                title={day}
                aria-pressed={selectedDay === day}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedDay(day);
                }}
                className={`min-w-0 px-1.5 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedDay === day
                    ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="sm:hidden">{day.slice(0, 3)}</span>
                <span className="hidden sm:inline">{day}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Timeline for Selected Day */}
      <div className="min-w-0 space-y-4">
        {classesForDay.length === 0 ? (
          <div className="p-6 sm:p-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-2">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No lectures scheduled for {selectedDay}</p>
            <p className="text-xs text-slate-400">Enjoy your study break or library revision.</p>
          </div>
        ) : (
          classesForDay.map((entry) => {
            const hasActiveSession = activeSessions.find((s) =>
              s.courseCode === entry.courseCode &&
              (!s.semesterId || !entry.semesterId || s.semesterId === entry.semesterId)
            );

            return (
              <div
                key={entry.id}
                className={`box-border w-full min-w-0 bg-white rounded-3xl border p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  hasActiveSession
                    ? 'border-indigo-400 ring-2 ring-indigo-500/10 shadow-md'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700">
                      {entry.courseCode}
                    </span>
                    {hasActiveSession && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>Live Geofence Open Now</span>
                      </span>
                    )}
                    {entry.isCancelled && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        Lecture Cancelled by Faculty
                      </span>
                    )}
                  </div>

                  <h3 className="break-words text-base font-black text-slate-900">{entry.courseTitle}</h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{entry.time}</span>
                    </span>
                    <span>•</span>
                    <span className="min-w-0 break-words flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{entry.location}</span>
                    </span>
                  </div>
                </div>

                {hasActiveSession && onOpenCheckIn && (
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onOpenCheckIn(hasActiveSession);
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>Check In Now</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
