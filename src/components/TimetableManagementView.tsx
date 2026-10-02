import React, { useState } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import type { TimetableEntry, User } from '../types';
import { createId } from '../lib/createId';

interface TimetableManagementViewProps {
  currentUser: User;
  timetable: TimetableEntry[];
  onSave: (
    semesterId: string,
    semesterName: string,
    entries: TimetableEntry[]
  ) => Promise<void>;
}

interface TimetableDraft {
  key: string;
  courseCode: string;
  courseTitle: string;
  level: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
}

type SemesterKey = 'first' | 'second';

const semesters: { key: SemesterKey; label: string }[] = [
  { key: 'first', label: 'First Semester' },
  { key: 'second', label: 'Second Semester' }
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createDrafts(timetable: TimetableEntry[], semesterName: string): TimetableDraft[] {
  return timetable
    .filter((entry) => entry.semesterName?.toLowerCase() === semesterName.toLowerCase())
    .map((entry) => {
      const timeParts = entry.time.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
      return {
        key: entry.id,
        courseCode: entry.courseCode,
        courseTitle: entry.courseTitle,
        level: entry.level ?? '',
        day: entry.day,
        startTime: timeParts?.[1] ?? '',
        endTime: timeParts?.[2] ?? entry.endTime ?? '',
        location: entry.location
      };
    });
}

export const TimetableManagementView: React.FC<TimetableManagementViewProps> = ({
  currentUser,
  timetable,
  onSave
}) => {
  const availableSessions = timetable
    .map((entry) => entry.semesterName?.match(/(\d{4}\/\d{4})$/)?.[1])
    .filter((session): session is string => Boolean(session))
    .sort();
  const defaultSession = availableSessions.at(-1) ??
    `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const [academicSession, setAcademicSession] = useState(defaultSession);
  const [sessionInput, setSessionInput] = useState(defaultSession);
  const semesterName = (key: SemesterKey) =>
    `${key === 'first' ? 'First' : 'Second'} Semester ${academicSession}`;
  const [drafts, setDrafts] = useState<Record<SemesterKey, TimetableDraft[]>>(() => ({
    first: createDrafts(timetable, `${semesters[0].label} ${defaultSession}`),
    second: createDrafts(timetable, `${semesters[1].label} ${defaultSession}`)
  }));
  const [saving, setSaving] = useState<SemesterKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSession = () => {
    const session = sessionInput.trim();
    if (!/^\d{4}\/\d{4}$/.test(session)) {
      setError('Enter the academic session in YYYY/YYYY format, for example 2026/2027.');
      return;
    }
    setAcademicSession(session);
    setDrafts({
      first: createDrafts(timetable, `First Semester ${session}`),
      second: createDrafts(timetable, `Second Semester ${session}`)
    });
    setError(null);
    setNotice(null);
  };

  const updateDraft = (
    semester: SemesterKey,
    key: string,
    field: keyof TimetableDraft,
    value: string
  ) => {
    setDrafts((previous) => ({
      ...previous,
      [semester]: previous[semester].map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft
      )
    }));
    setError(null);
    setNotice(null);
  };

  const saveSemester = async (semester: SemesterKey) => {
    if (sessionInput.trim() !== academicSession) {
      setError('Load the new academic session before saving its timetable.');
      return;
    }
    const rows = drafts[semester].map((draft) => ({
      ...draft,
      courseCode: draft.courseCode.trim().toUpperCase(),
      courseTitle: draft.courseTitle.trim(),
      level: draft.level.trim(),
      location: draft.location.trim()
    }));
    if (rows.length === 0) {
      setError('Add at least one timetable entry before saving this semester.');
      return;
    }
    const incomplete = rows.find((row) =>
      !row.courseCode || !row.courseTitle || !row.level || !row.day ||
      !row.startTime || !row.endTime || !row.location
    );
    if (incomplete) {
      setError('Complete the course, level, day, start/end times, and venue for every timetable row.');
      return;
    }
    const invalidTime = rows.find((row) => row.endTime <= row.startTime);
    if (invalidTime) {
      setError(`End time must be after start time for ${invalidTime.courseCode}.`);
      return;
    }

    const name = semesterName(semester);
    const id = slug(name);
    const entries: TimetableEntry[] = rows.map((row, index) => ({
      id: `${id}-${slug(currentUser.department)}-${slug(row.level)}-${index + 1}`,
      semesterId: id,
      semesterName: name,
      department: currentUser.department.trim(),
      level: row.level,
      day: row.day as TimetableEntry['day'],
      time: `${row.startTime}–${row.endTime}`,
      endTime: row.endTime,
      courseCode: row.courseCode,
      courseTitle: row.courseTitle,
      location: row.location
    }));

    setSaving(semester);
    setError(null);
    setNotice(null);
    try {
      await onSave(id, name, entries);
      setNotice(`${name} timetable saved with ${entries.length} entries.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the timetable.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="box-border w-full min-w-0 max-w-full space-y-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900">Manage Semester Timetables</h3>
          <p className="mt-1 text-xs text-slate-500">
            Enter timetable rows for either semester at any time. Students see schedules for their department and level.
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

      {semesters.map(({ key, label }) => (
        <section key={key} className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-extrabold text-slate-800">{label} timetable</h4>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => {
                  setDrafts((previous) => ({
                    ...previous,
                    [key]: [
                      ...previous[key],
                      {
                        key: createId(),
                        courseCode: '',
                        courseTitle: '',
                        level: currentUser.level,
                        day: '',
                        startTime: '',
                        endTime: '',
                        location: ''
                      }
                    ]
                  }));
                  setError(null);
                  setNotice(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add entry
              </button>
              <button
                type="button"
                onClick={() => void saveSemester(key)}
                disabled={saving !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving === key ? 'Saving…' : 'Save timetable'}
              </button>
            </div>
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="bg-white text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Course code</th>
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
                {drafts[key].map((draft) => (
                  <tr key={draft.key}>
                    {([
                      ['courseCode', 'e.g. CSC 201'],
                      ['courseTitle', 'Course title'],
                      ['level', 'e.g. 200L']
                    ] as const).map(([field, placeholder]) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          value={draft[field]}
                          onChange={(event) => updateDraft(key, draft.key, field, event.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <select
                        value={draft.day}
                        onChange={(event) => updateDraft(key, draft.key, 'day', event.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                      >
                        <option value="">Select day</option>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </td>
                    {(['startTime', 'endTime'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          type="time"
                          value={draft[field]}
                          onChange={(event) => updateDraft(key, draft.key, field, event.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <input
                        value={draft.location}
                        onChange={(event) => updateDraft(key, draft.key, 'location', event.target.value)}
                        placeholder="Venue"
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDrafts((previous) => ({
                            ...previous,
                            [key]: previous[key].filter((item) => item.key !== draft.key)
                          }));
                          setError(null);
                          setNotice(null);
                        }}
                        aria-label={`Remove ${draft.courseCode || 'timetable entry'}`}
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
                      No entries for {label.toLowerCase()} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="w-full min-w-0 space-y-3 p-3 sm:hidden">
            {drafts[key].map((draft) => (
              <article key={draft.key} className="box-border w-full min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['courseCode', 'Course code', 'e.g. CSC 201'],
                    ['courseTitle', 'Course title', 'Course title'],
                    ['level', 'Level', 'e.g. 200L']
                  ] as const).map(([field, labelText, placeholder]) => (
                    <label key={field} className={`min-w-0 text-[11px] font-bold text-slate-600 ${field === 'courseTitle' ? 'col-span-2' : ''}`}>
                      {labelText}
                      <input
                        value={draft[field]}
                        onChange={(event) => updateDraft(key, draft.key, field, event.target.value)}
                        placeholder={placeholder}
                        className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                      />
                    </label>
                  ))}
                  <label className="col-span-2 min-w-0 text-[11px] font-bold text-slate-600">
                    Day
                    <select
                      value={draft.day}
                      onChange={(event) => updateDraft(key, draft.key, 'day', event.target.value)}
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                    >
                      <option value="">Select day</option>
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
                        value={draft[field]}
                        onChange={(event) => updateDraft(key, draft.key, field, event.target.value)}
                        className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                      />
                    </label>
                  ))}
                  <label className="col-span-2 min-w-0 text-[11px] font-bold text-slate-600">
                    Venue
                    <input
                      value={draft.location}
                      onChange={(event) => updateDraft(key, draft.key, 'location', event.target.value)}
                      placeholder="Venue"
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-800"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDrafts((previous) => ({
                      ...previous,
                      [key]: previous[key].filter((item) => item.key !== draft.key)
                    }));
                    setError(null);
                    setNotice(null);
                  }}
                  aria-label={`Remove ${draft.courseCode || 'timetable entry'}`}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove entry
                </button>
              </article>
            ))}
            {drafts[key].length === 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                No entries for {label.toLowerCase()} yet.
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
