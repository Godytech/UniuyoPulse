import React, { useEffect, useState } from 'react';
import { Building2, GraduationCap, Mail, Save, UserRound } from 'lucide-react';
import type { User } from '../types';
import { getInitials } from '../lib/avatar';

interface ProfileViewProps {
  currentUser: User;
  onSaveProfile: (user: User) => Promise<void>;
}

interface ProfileDraft {
  fullName: string;
  studentId: string;
  department: string;
  faculty: string;
  level: string;
  semester: 'First Semester' | 'Second Semester' | '';
  academicSession: string;
}

function profileDraft(user: User): ProfileDraft {
  return {
    fullName: user.fullName,
    studentId: user.studentId ?? '',
    department: user.department,
    faculty: user.faculty ?? '',
    level: user.level,
    semester: user.semester ?? '',
    academicSession: user.academicSession ?? ''
  };
}

function roleLabel(role: User['role']): string {
  switch (role) {
    case 'lecturer':
      return 'Lecturer';
    case 'course_rep_admin':
    case 'rep_admin':
      return 'Course Rep Admin';
    case 'assistant_course_rep':
      return 'Assistant Course Rep';
    default:
      return 'Student';
  }
}

function canEditProfile(role: User['role']): boolean {
  return role === 'student' ||
    role === 'course_rep_admin' ||
    role === 'assistant_course_rep' ||
    role === 'rep_admin';
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onSaveProfile }) => {
  const [draft, setDraft] = useState(() => profileDraft(currentUser));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(profileDraft(currentUser));
  }, [currentUser]);

  const updateDraft = (field: keyof ProfileDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (
      !draft.fullName.trim() ||
      !draft.studentId.trim() ||
      !draft.department.trim() ||
      !draft.faculty.trim() ||
      !draft.level.trim()
    ) {
      setError('Complete your name, registration number, faculty, department, and level.');
      return;
    }
    if (!draft.semester) {
      setError('Choose your current semester.');
      return;
    }
    const sessionMatch = draft.academicSession.trim().match(/^(\d{4})\/(\d{4})$/);
    if (!sessionMatch || Number(sessionMatch[2]) !== Number(sessionMatch[1]) + 1) {
      setError('Enter a valid academic session in YYYY/YYYY format, for example 2026/2027.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveProfile({
        ...currentUser,
        fullName: draft.fullName.trim(),
        studentId: draft.studentId.trim().toUpperCase(),
        department: draft.department.trim(),
        faculty: draft.faculty.trim(),
        level: draft.level.trim(),
        semester: draft.semester,
        academicSession: draft.academicSession.trim()
      });
      setNotice('Your profile and attendance term have been updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">My Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Your University of Uyo account information.</p>
      </header>

      <section className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-8">
        <div className="flex min-w-0 flex-col items-start gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:gap-6">
          <span
            aria-label={currentUser.fullName}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-black text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl"
          >
            {getInitials(currentUser.fullName)}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-lg font-black text-slate-900 sm:text-xl">{currentUser.fullName}</h3>
            <p className="mt-1 text-xs font-bold text-emerald-700">{roleLabel(currentUser.role)}</p>
            <p className="mt-1 break-all text-sm text-slate-500">{currentUser.email}</p>
          </div>
        </div>

        {canEditProfile(currentUser.role) ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Full name
                <input
                  required
                  value={draft.fullName}
                  onChange={(event) => updateDraft('fullName', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Registration / staff ID (managed by your institution)
                <input
                  required
                  value={draft.studentId}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Faculty (managed by your invitation)
                <input
                  required
                  value={draft.faculty}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Department (managed by your invitation)
                <input
                  required
                  value={draft.department}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Level (managed by your invitation)
                <input
                  required
                  value={draft.level}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                University email (managed by your account)
                <input
                  value={currentUser.email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-500"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
              <h3 className="text-sm font-black text-slate-900">Attendance term</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Your semester and academic session determine which tagged attendance sessions you can join.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Semester
                  <select
                    required
                    value={draft.semester}
                    onChange={(event) => updateDraft('semester', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="">Choose your semester</option>
                    <option value="First Semester">First Semester</option>
                    <option value="Second Semester">Second Semester</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Academic session
                  <input
                    required
                    value={draft.academicSession}
                    onChange={(event) => updateDraft('academicSession', event.target.value)}
                    placeholder="e.g. 2026/2027"
                    pattern="[0-9]{4}/[0-9]{4}"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </label>
              </div>
            </div>

            {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
            {notice && <p role="status" className="text-sm font-semibold text-emerald-700">{notice}</p>}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving profile…' : 'Save profile'}
            </button>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-4">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Registration / Staff ID</dt>
                  <dd className="mt-1 break-all text-sm font-semibold text-slate-900">{currentUser.studentId || 'Not provided'}</dd>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-4">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">University Email</dt>
                  <dd className="mt-1 break-all text-sm font-semibold text-slate-900">{currentUser.email}</dd>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-4">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Department / Faculty</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {[currentUser.department, currentUser.faculty].filter(Boolean).join(' / ') || 'Not provided'}
                  </dd>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-4">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Level</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{currentUser.level || 'Not provided'}</dd>
                </div>
              </div>
            </dl>
            <p className="text-xs leading-5 text-slate-500">
              Profile information is managed by your institution. Contact an administrator if any details need correction.
            </p>
          </>
        )}
      </section>
    </div>
  );
};
