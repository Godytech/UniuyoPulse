import React from 'react';
import type { AttendanceRecord, AttendanceSession, Course, StudentDetail, User } from '../types';
import { formatDepartment } from '../lib/formatDepartment';
import { formatFaculty } from '../lib/formatFaculty';

interface ClassAttendanceSheetProps {
  session: AttendanceSession;
  course?: Course;
  records: AttendanceRecord[];
  students: StudentDetail[];
  currentUser: User;
}

interface SheetRow {
  id: string;
  name: string;
  registrationNumber: string;
  status: AttendanceRecord['status'];
  submittedAt?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(value);
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : formatTime(date);
}

function statusLabel(status: AttendanceRecord['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const ClassAttendanceSheet: React.FC<ClassAttendanceSheetProps> = ({
  session,
  course,
  records,
  students,
  currentUser
}) => {
  const sessionRecords = records.filter((record) => record.sessionId === session.id);
  const courseDepartment = course?.department ?? currentUser.department;
  const roster = students
    .filter((student) =>
      student.role !== 'lecturer' &&
      normalize(student.department) === normalize(courseDepartment) &&
      normalize(student.level) === normalize(course?.level ?? currentUser.level)
    )
    .map((student) => ({
      id: student.id,
      name: student.fullName,
      registrationNumber: student.studentId
    }));
  const rowsById = new Map<string, SheetRow>();

  roster.forEach((student) => {
    const record = sessionRecords.find((item) => item.studentId === student.id);
    rowsById.set(student.id, {
      ...student,
      status: record?.status ?? 'absent',
      submittedAt: record?.submittedAt
    });
  });

  const isCourseRep = currentUser.role === 'rep_admin' ||
    currentUser.role === 'course_rep_admin' ||
    currentUser.role === 'assistant_course_rep';
  if (isCourseRep && !rowsById.has(currentUser.id)) {
    const record = sessionRecords.find((item) => item.studentId === currentUser.id);
    rowsById.set(currentUser.id, {
      id: currentUser.id,
      name: currentUser.fullName,
      registrationNumber: currentUser.studentId ?? '',
      status: record?.status ?? 'absent',
      submittedAt: record?.submittedAt
    });
  }

  const rows = Array.from(rowsById.values()).sort((left, right) => {
    if (isCourseRep) {
      if (left.id === currentUser.id) return -1;
      if (right.id === currentUser.id) return 1;
    }
    return left.name.localeCompare(right.name);
  });
  const startDate = new Date(session.startTime);
  const endDate = new Date(session.endTime);
  const generatedAt = new Date();
  const lecturerName = session.lecturerName ?? '';
  const classDate = Number.isNaN(startDate.getTime()) ? '' : formatDate(startDate);
  const classTime = !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())
    ? `${formatTime(startDate)} - ${formatTime(endDate)}`
    : '';
  const department = formatDepartment(currentUser.department || courseDepartment);

  return (
    <article className="class-attendance-print" aria-label="Class attendance sheet">
      <header className="class-sheet-header">
        <img className="class-sheet-logo" src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo crest" />
        <h1>UNIVERSITY OF UYO</h1>
        <p className="class-sheet-department">{department}</p>
        <p className="class-sheet-faculty">{formatFaculty(currentUser.faculty)}</p>
        <h2>Class Attendance Sheet</h2>
      </header>

      <section className="class-sheet-meta">
        <div className="class-sheet-course-details">
          <p>Attendance Sheet for <strong>{session.courseCode}</strong></p>
          <p>Lecturer: {lecturerName}</p>
          <p>Venue: {session.locationName}</p>
        </div>
        <div className="class-sheet-session-meta">
          <p>Class Date: <strong>{classDate}</strong></p>
          <p>Class Time: <strong>{classTime}</strong></p>
          <p>Date Generated: <strong>{formatDate(generatedAt)}</strong></p>
          <p>System: <strong>Uniuyo Pulse GPS Geofence Engine</strong></p>
        </div>
      </section>

      <div className="sheet-table-scroll class-sheet-table-wrap">
        <table className="class-sheet-table">
          <colgroup>
            <col className="class-sheet-col-number" />
            <col className="class-sheet-col-name" />
            <col className="class-sheet-col-reg" />
            <col className="class-sheet-col-status" />
            <col className="class-sheet-col-time" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">S/N</th>
              <th scope="col">Student Name</th>
              <th scope="col">Student Reg No</th>
              <th scope="col">Status</th>
              <th scope="col">Check-in Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="class-sheet-empty">No students are available for this course.</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id}>
                <td className="class-sheet-centered">{index + 1}</td>
                <td>{row.name}</td>
                <td>{row.registrationNumber}</td>
                <td className={`class-sheet-centered class-sheet-status class-sheet-status-${row.status}`}>
                  {statusLabel(row.status)}
                </td>
                <td className="class-sheet-centered">
                  {row.status === 'absent' ? '—' : formatTimestamp(row.submittedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="class-sheet-signatures">
        <section>
          <h3>PREPARED BY (COURSE REP ADMIN)</h3>
          <div className="class-sheet-signature-line" />
          <p>{currentUser.fullName} ({currentUser.studentId ?? ''})</p>
          <p>Signature &amp; Date</p>
        </section>
        <section>
          <h3>VERIFIED BY (COURSE LECTURER)</h3>
          <div className="class-sheet-signature-line" />
          <p>Signature &amp; Date</p>
        </section>
        <section>
          <h3>APPROVED BY (HEAD OF DEPARTMENT)</h3>
          <div className="class-sheet-signature-line" />
          <p>Signature &amp; Date</p>
        </section>
      </footer>
    </article>
  );
};
