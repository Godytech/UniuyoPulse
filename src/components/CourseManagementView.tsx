import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import type { Course, TimetableEntry, User } from '../types';
import { createId } from '../lib/createId';

interface CourseManagementViewProps {
  currentUser: User;
  courses: Course[];
  timetable: TimetableEntry[];
  onSave: (
    semesterId: string,
    semesterName: string,
    courses: Course[],
    timetable: TimetableEntry[]
  ) => Promise<void>;
}

interface CourseDraft {
  key: string;
  code: string;
  title: string;
  level: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
}

type SemesterKey = 'first' | 'second';

const semesterOptions: { key: SemesterKey; label: string }[] = [
  { key: 'first', label: 'First Semester' },
  { key: 'second', label: 'Second Semester' }
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function semesterCourses(
  courses: Course[],
  semesterName: string,
  key: SemesterKey
): Course[] {
  const normalizedSemesterName = semesterName.toLowerCase();
  return courses.filter((course) => {
    if (course.semesterName) return course.semesterName.toLowerCase() === normalizedSemesterName;
    const courseId = course.semesterId?.toLowerCase() ?? '';
    const sessionSlug = slug(normalizedSemesterName.split(' ').at(-1) ?? '');
    return courseId.includes(`${key}-semester-${sessionSlug}`);
  });
}

function timeParts(value: string): [string, string] {
  const match = value.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
  return match ? [match[1], match[2]] : ['', ''];
}

function createDrafts(
  courses: Course[],
  timetable: TimetableEntry[],
  semesterName: string,
  semesterKey: SemesterKey
): CourseDraft[] {
  return semesterCourses(courses, semesterName, semesterKey).map((course) => {
    const entry = timetable.find((item) =>
      item.semesterId === course.semesterId &&
      item.courseCode.toLowerCase() === course.code.toLowerCase() &&
      (item.level ?? '').toLowerCase() === course.level.toLowerCase()
    );
    const [startTime, endTime] = timeParts(entry?.time ?? course.scheduleTime);
    return {
      key: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      day: entry?.day ?? course.scheduleDay,
      startTime,
      endTime,
      location: entry?.location ?? course.classroom
    };
  });
}

export const CourseManagementView: React.FC<CourseManagementViewProps> = ({
  currentUser,
  courses,
  timetable,
  onSave
}) => {
  const existingSessions = courses
    .map((course) => course.semesterName?.match(/(\d{4}\/\d{4})$/)?.[1])
    .filter((session): session is string => Boolean(session))
    .sort();
  const defaultSession = existingSessions.at(-1) ??
    `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const [academicSession, setAcademicSession] = useState(defaultSession);
  const [sessionInput, setSessionInput] = useState(defaultSession);
  const [drafts, setDrafts] = useState<Record<SemesterKey, CourseDraft[]>>(() => ({
    first: createDrafts(courses, timetable, `First Semester ${defaultSession}`, 'first'),
    second: createDrafts(courses, timetable, `Second Semester ${defaultSession}`, 'second')
  }));
  const [saving, setSaving] = useState<SemesterKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const semesterNames = useMemo(() => ({
    first: `First Semester ${academicSession.trim()}`,
    second: `Second Semester ${academicSession.trim()}`
  }), [academicSession]);

  const loadSession = () => {
    const session = sessionInput.trim();
    if (!/^\d{4}\/\d{4}$/.test(session)) {
      setError('Enter the academic session in YYYY/YYYY format, for example 2026/2027.');
      return;
    }
    setAcademicSession(session);
    setDrafts({
      first: createDrafts(courses, timetable, `First Semester ${session}`, 'first'),
      second: createDrafts(courses, timetable, `Second Semester ${session}`, 'second')
    });
    setError(null);
    setNotice(null);
  };

  const addCourse = (semester: SemesterKey) => {
    setDrafts((previous) => ({
      ...previous,
      [semester]: [
        ...previous[semester],
        { key: createId(), code: '', title: '', level: currentUser.level, day: '', startTime: '', endTime: '', location: '' }
      ]
    }));
    setError(null);
    setNotice(null);
  };

  const updateDraft = (semester: SemesterKey, key: string, field: keyof CourseDraft, value: string) => {
    setDrafts((previous) => ({
      ...previous,
      [semester]: previous[semester].map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft
      )
    }));
    setError(null);
    setNotice(null);
  };

  const removeDraft = (semester: SemesterKey, key: string) => {
    setDrafts((previous) => ({
      ...previous,
      [semester]: previous[semester].filter((draft) => draft.key !== key)
    }));
    setError(null);
    setNotice(null);
  };

  const saveSemester = async (semester: SemesterKey) => {
    const session = academicSession.trim();
    if (sessionInput.trim() !== session) {
      setError('Load the new academic session before saving its course tables.');
      return;
    }
    if (!/^\d{4}\/\d{4}$/.test(session)) {
      setError('Enter the academic session in YYYY/YYYY format, for example 2026/2027.');
      return;
    }
    const rows = drafts[semester];
    if (rows.length === 0) {
      setError('Add at least one course before saving this semester.');
      return;
    }
    const completeRows = rows.map((row) => ({
      ...row,
      code: row.code.trim().toUpperCase(),
      title: row.title.trim(),
      level: row.level.trim(),
      location: row.location.trim()
    }));
    if (completeRows.some((row) => !row.code || !row.title || !row.level)) {
      setError('Every course needs a course code, title, and level.');
      return;
    }
    const duplicateCodes = new Set<string>();
    for (const row of completeRows) {
      const duplicateKey = `${row.code}|${row.level.toLowerCase()}`;
      if (duplicateCodes.has(duplicateKey)) {
        setError(`Course ${row.code} is listed more than once for ${row.level}.`);
        return;
      }
      duplicateCodes.add(duplicateKey);
      const scheduleValues = [row.day, row.startTime, row.endTime, row.location];
      if (scheduleValues.some(Boolean) && scheduleValues.some((value) => !value)) {
        setError(`Complete the day, start time, end time, and location for ${row.code}, or leave all four blank.`);
        return;
      }
      if (row.startTime && row.endTime && row.endTime <= row.startTime) {
        setError(`End time must be after start time for ${row.code}.`);
        return;
      }
    }

    const semesterName = semesterNames[semester];
    const semesterId = slug(semesterName);
    const previousCourses = semesterCourses(courses, semesterName, semester);
    const nextCourses: Course[] = completeRows.map((row) => {
      const existing = previousCourses.find((course) =>
        course.code.toLowerCase() === row.code.toLowerCase() &&
        course.level.toLowerCase() === row.level.toLowerCase()
      );
      return {
        id: `${semesterId}-${slug(currentUser.department)}-${slug(row.level)}-${slug(row.code)}`,
        semesterId,
        semesterName,
        code: row.code,
        title: row.title,
        department: currentUser.department.trim(),
        level: row.level,
        repId: existing?.repId ?? '',
        repName: existing?.repName ?? '',
        scheduleDay: row.day,
        scheduleTime: row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : '',
        classroom: row.location,
        enrolledStudentCount: existing?.enrolledStudentCount ?? 0
      };
    });
    const nextTimetable: TimetableEntry[] = completeRows
      .filter((row) => row.day && row.startTime && row.endTime && row.location)
      .map((row, index) => ({
        id: `${semesterId}-${slug(currentUser.department)}-${slug(row.level)}-${index + 1}`,
        semesterId,
        semesterName,
        department: currentUser.department.trim(),
        level: row.level,
        day: row.day as TimetableEntry['day'],
        time: `${row.startTime}–${row.endTime}`,
        endTime: row.endTime,
        courseCode: row.code,
        courseTitle: row.title,
        location: row.location
      }));

    setSaving(semester);
    setError(null);
    setNotice(null);
    try {
      await onSave(semesterId, semesterName, nextCourses, nextTimetable);
      setNotice(`${semesterName} saved: ${nextCourses.length} courses and ${nextTimetable.length} timetable entries.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the course table.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="box-border w-full min-w-0 max-w-full space-y-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-900">Manage Semester Courses</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Add course details for each semester. Students can view courses matching their department and level.
          </p>
        </div>
        <div className="flex min-w-0 items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">
            Academic Session
            <input
              value={sessionInput}
              onChange={(event) => setSessionInput(event.target.value)}
              placeholder="2026/2027"
              className="mt-1 block box-border w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 sm:w-36"
            />
          </label>
          <button
            type="button"
            onClick={loadSession}
            disabled={saving !== null}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Load session
          </button>
        </div>
      </header>

      {semesterOptions.map(({ key, label }) => (
        <section key={key} className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-extrabold text-slate-800">{label}</h3>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => addCourse(key)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add course
              </button>
              <button
                type="button"
                onClick={() => void saveSemester(key)}
                disabled={saving !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving === key ? 'Saving…' : 'Save table'}
              </button>
            </div>
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="bg-white text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Course title</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-3 py-3">Day</th>
                  <th className="px-3 py-3">Start</th>
                  <th className="px-3 py-3">End</th>
                  <th className="px-3 py-3">Venue</th>
                  <th className="px-3 py-3"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts[key].map((row) => (
                  <tr key={row.key}>
                    {([
                      ['code', 'e.g. CSC 201'],
                      ['title', 'Course title'],
                      ['level', 'e.g. 200L']
                    ] as const).map(([field, placeholder]) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          value={row[field]}
                          onChange={(event) => updateDraft(key, row.key, field, event.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <select
                        value={row.day}
                        onChange={(event) => updateDraft(key, row.key, 'day', event.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                      >
                        <option value="">Optional</option>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </td>
                    {(['startTime', 'endTime'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          type="time"
                          value={row[field]}
                          onChange={(event) => updateDraft(key, row.key, field, event.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <input
                        value={row.location}
                        onChange={(event) => updateDraft(key, row.key, 'location', event.target.value)}
                        placeholder="Venue"
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeDraft(key, row.key)}
                        aria-label={`Remove ${row.code || 'course row'}`}
                        className="rounded-md p-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {drafts[key].length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                      No courses added for {label.toLowerCase()} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="w-full min-w-0 space-y-3 p-3 sm:hidden">
            {drafts[key].map((row) => (
              <article key={row.key} className="box-border w-full min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['code', 'Course code', 'e.g. CSC 201'],
                    ['title', 'Course title', 'Course title'],
                    ['level', 'Level', 'e.g. 200L']
                  ] as const).map(([field, labelText, placeholder]) => (
                    <label key={field} className={`min-w-0 text-[11px] font-bold text-slate-600 ${field === 'title' ? 'col-span-2' : ''}`}>
                      {labelText}
                      <input
                        value={row[field]}
                        onChange={(event) => updateDraft(key, row.key, field, event.target.value)}
                        placeholder={placeholder}
                        className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                      />
                    </label>
                  ))}
                  <label className="min-w-0 text-[11px] font-bold text-slate-600">
                    Day
                    <select
                      value={row.day}
                      onChange={(event) => updateDraft(key, row.key, 'day', event.target.value)}
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                    >
                      <option value="">Optional</option>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </label>
                  {([
                    ['startTime', 'Start time'],
                    ['endTime', 'End time']
                  ] as const).map(([field, labelText]) => (
                    <label key={field} className="col-span-2 min-w-0 text-[11px] font-bold text-slate-600">
                      {labelText}
                      <input
                        type="time"
                        value={row[field]}
                        onChange={(event) => updateDraft(key, row.key, field, event.target.value)}
                        className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                      />
                    </label>
                  ))}
                  <label className="col-span-2 min-w-0 text-[11px] font-bold text-slate-600">
                    Venue
                    <input
                      value={row.location}
                      onChange={(event) => updateDraft(key, row.key, 'location', event.target.value)}
                      placeholder="Venue"
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeDraft(key, row.key)}
                  aria-label={`Remove ${row.code || 'course row'}`}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove course
                </button>
              </article>
            ))}
            {drafts[key].length === 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                No courses added for {label.toLowerCase()} yet.
              </p>
            )}
          </div>
        </section>
      ))}

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}
    </section>
  );
};
