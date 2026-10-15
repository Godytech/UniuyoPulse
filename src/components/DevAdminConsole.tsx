import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, Building2, Check, Clock3,
  Download, Filter, Radio, RefreshCw, Search, Settings2, ShieldAlert,
  Users, X
} from 'lucide-react';
import type {
  AttendanceRecord, AttendanceSession, AuditLogEntry, Course, Faculty,
  NavTab, StudentDetail, User
} from '../types';
import { runDevAdminAction } from '../lib/store';
import type { DevAdminSnapshot } from '../lib/store';
import { soundManager } from '../lib/sound';
import { RadiusGauge } from './RadiusGauge';
import { StudentDetailModal } from './StudentDetailModal';
import type { GeofenceVerification } from '../types';

interface DevAdminConsoleProps {
  currentUser: User;
  activeTab: NavTab;
  data: DevAdminSnapshot;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onActionComplete: () => void;
}

type SessionState = 'scheduled' | 'live' | 'expired-but-not-closed' | 'closed';
type PendingAction = { action: string; targetId: string; label: string };
const tabs: Record<string, string> = {
  dev_live_ops: 'Live Operations',
  dev_explorer: 'Faculty & Department Explorer',
  dev_people: 'People Directory',
  dev_activity: 'Activity Feed & Audit Log',
  dev_anomalies: 'Anomaly & Integrity Alerts',
  dev_analytics: 'Analytics & Reports',
  dev_system: 'System & Config'
};

function effectiveStatus(session: AttendanceSession, now: number): SessionState {
  const start = Date.parse(session.startTime);
  const end = Date.parse(session.endTime);
  if (session.status === 'closed') return 'closed';
  if (Number.isFinite(start) && now < start) return 'scheduled';
  if (Number.isFinite(end) && now > end) return 'expired-but-not-closed';
  return 'live';
}

function csvDownload(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function attendanceCoverage(records: AttendanceRecord[], sessions: AttendanceSession[]): number {
  const enrollment = sessions.reduce((total, session) => total + (session.maxStudents ?? 0), 0);
  return enrollment ? Math.min(100, Math.round(records.length / enrollment * 100)) : 0;
}

export const DevAdminConsole: React.FC<DevAdminConsoleProps> = ({
  currentUser, activeTab, data, lastUpdated, loading, error, onRefresh, onActionComplete
}) => {
  const [query, setQuery] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [lecturerFilter, setLecturerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [selectedEvidenceRecordId, setSelectedEvidenceRecordId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auditActor, setAuditActor] = useState('all');
  const [auditRole, setAuditRole] = useState('all');
  const [auditAction, setAuditAction] = useState('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [broadcast, setBroadcast] = useState({
    scope: 'everyone',
    scopeValue: '',
    title: '',
    body: ''
  });
  const [config, setConfig] = useState(() => {
    const saved = data.appConfig.find((entry) => entry.id === 'devSettings') ?? {};
    return {
      minRadiusMeters: Number(saved.minRadiusMeters ?? 10),
      maxGpsAccuracyMeters: Number(saved.maxGpsAccuracyMeters ?? 50),
      lateThresholdMinutes: Number(saved.lateThresholdMinutes ?? 15),
      pinLength: Number(saved.pinLength ?? 6),
      semesterName: String(saved.semesterName ?? 'First Semester 2025/2026'),
      featureFlags: {
        anomalyAlerts: Boolean((saved.featureFlags as Record<string, unknown> | undefined)?.anomalyAlerts),
        managementBroadcasts: Boolean((saved.featureFlags as Record<string, unknown> | undefined)?.managementBroadcasts)
      }
    };
  });
  const now = Date.now();
  const coursesById = useMemo(() => new Map(data.courses.map((course) => [course.id, course])), [data.courses]);
  const recordsBySession = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const record of data.records) map.set(record.sessionId, [...(map.get(record.sessionId) ?? []), record]);
    return map;
  }, [data.records]);
  const normalizedQuery = query.trim().toLowerCase();
  const sessions = useMemo(() => data.sessions.filter((session) => {
    const course = coursesById.get(session.courseId);
    const status = effectiveStatus(session, now);
    const textMatch = !normalizedQuery || [
      session.courseCode, session.courseTitle, session.locationName, session.lecturerName,
      session.department, session.faculty, course?.faculty, course?.department
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    return textMatch &&
      (facultyFilter === 'all' || (session.faculty ?? course?.faculty) === facultyFilter) &&
      (departmentFilter === 'all' || (session.department ?? course?.department) === departmentFilter) &&
      (levelFilter === 'all' || (session.courseLevel ?? course?.level) === levelFilter) &&
      (lecturerFilter === 'all' || session.lecturerId === lecturerFilter) &&
      (statusFilter === 'all' || status === statusFilter);
  }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)), [
    data.sessions, coursesById, now, normalizedQuery, facultyFilter, departmentFilter, levelFilter, lecturerFilter, statusFilter
  ]);
  const openReasonDialog = (action: string, targetId: string, label: string) => {
    soundManager.playClick();
    setPendingAction({ action, targetId, label });
    setReason('');
    setActionError(null);
  };
  const confirmAction = async () => {
    if (!pendingAction || reason.trim().length < 8) {
      setActionError('Write a reason of at least 8 characters.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await runDevAdminAction({
        action: pendingAction.action,
        targetId: pendingAction.targetId,
        reason: reason.trim(),
        ...(pendingAction.action === 'broadcast' ? broadcast : {})
      });
      setPendingAction(null);
      setSelectedSession(null);
      onActionComplete();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  };
  const pageTitle = tabs[activeTab] ?? 'Management Console';

  useEffect(() => {
    const saved = data.appConfig.find((entry) => entry.id === 'devSettings');
    if (!saved) return;
    const flags = saved.featureFlags as Record<string, unknown> | undefined;
    setConfig({
      minRadiusMeters: Number(saved.minRadiusMeters ?? 10),
      maxGpsAccuracyMeters: Number(saved.maxGpsAccuracyMeters ?? 50),
      lateThresholdMinutes: Number(saved.lateThresholdMinutes ?? 15),
      pinLength: Number(saved.pinLength ?? 6),
      semesterName: String(saved.semesterName ?? 'First Semester 2025/2026'),
      featureFlags: {
        anomalyAlerts: flags?.anomalyAlerts === true,
        managementBroadcasts: flags?.managementBroadcasts === true
      }
    });
  }, [data.appConfig]);

  const stats = [
    ['People', data.userProfiles.length],
    ['Courses', data.courses.length],
    ['Sessions', data.sessions.length],
    ['Attendance records', data.records.length]
  ];
  const facultyGroups = new Map<string, Set<string>>();
  for (const faculty of data.faculties) {
    facultyGroups.set(faculty.name, new Set(faculty.departments));
  }
  for (const item of [...data.userProfiles, ...data.courses]) {
    if (item.faculty) {
      const group = facultyGroups.get(item.faculty) ?? new Set<string>();
      if (item.department) group.add(item.department);
      facultyGroups.set(item.faculty, group);
    }
  }
  if (!facultyGroups.size) {
    facultyGroups.set('Faculty not recorded', new Set([
      ...data.userProfiles.map((person) => person.department).filter(Boolean),
      ...data.courses.map((course) => course.department).filter(Boolean)
    ]));
  }
  const facultyNames = Array.from(facultyGroups.keys()).sort();
  const departments = Array.from(new Set([
    ...data.faculties.flatMap((faculty) => faculty.departments),
    ...data.courses.map((course) => course.department)
  ])).sort();
  const activeSessions = sessions.filter((session) => effectiveStatus(session, now) === 'live');

  const renderLiveOperations = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative grow min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input aria-label="Search sessions" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, title, lecturer, room..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </label>
          <SelectFilter label="Faculty" value={facultyFilter} onChange={setFacultyFilter} values={facultyNames} />
          <SelectFilter label="Department" value={departmentFilter} onChange={setDepartmentFilter} values={departments} />
          <SelectFilter label="Level" value={levelFilter} onChange={setLevelFilter} values={Array.from(new Set(data.courses.map((course) => course.level)))} />
          <SelectFilter label="Lecturer" value={lecturerFilter} onChange={setLecturerFilter}
            values={data.userProfiles.filter((user) => user.role !== 'student').map((user) => user.id)}
            labels={Object.fromEntries(data.userProfiles.map((user) => [user.id, user.fullName]))} />
          <SelectFilter label="Status" value={statusFilter} onChange={setStatusFilter} values={['live', 'scheduled', 'expired-but-not-closed', 'closed']} />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live monitoring · refreshed every few seconds</span>
          <span>Updated {lastUpdated?.toLocaleTimeString() ?? '—'}</span>
        </div>
      </div>
      {sessions.length === 0 ? <EmptyState message="No sessions match the current filters." /> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {sessions.map((session) => {
            const records = recordsBySession.get(session.id) ?? [];
            const course = coursesById.get(session.courseId);
            const state = effectiveStatus(session, now);
            const enrolled = session.maxStudents ?? course?.enrolledStudentCount ?? 0;
            const attendanceRate = enrolled ? Math.round(records.length / enrolled * 100) : 0;
            const countdown = Date.parse(session.endTime) - now;
            return (
              <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <div><p className="font-extrabold text-slate-900">{session.courseCode} · {session.courseTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">{session.faculty ?? course?.faculty ?? 'Faculty not set'} / {session.department ?? course?.department ?? 'Department not set'}</p></div>
                  <StatusPill status={state} />
                </div>
                {state === 'expired-but-not-closed' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Stale session: end time passed but the session remains open.</p>}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <DataPoint label="Opened by" value={session.lecturerName ?? 'Unknown'} />
                  <DataPoint label="Room" value={session.locationName} />
                  <DataPoint label="Radius" value={`${session.radiusMeters} m`} />
                  <DataPoint label="Starts" value={new Date(session.startTime).toLocaleTimeString()} />
                  <DataPoint label="Ends" value={new Date(session.endTime).toLocaleTimeString()} />
                  <DataPoint label={state === 'live' ? 'Time left' : 'Enrollment'} value={state === 'live' ? `${Math.max(0, Math.ceil(countdown / 60000))} min` : `${enrolled} students`} />
                </dl>
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-600"><span>Check-ins {records.length} / {enrolled || '—'}</span><span>{attendanceRate}%</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.min(100, attendanceRate)}%` }} /></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setSelectedEvidenceRecordId(null); setSelectedSession(session); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30">Session details</button>
                  {state === 'live' && <button onClick={() => openReasonDialog('force_close', session.id, `Force-close ${session.courseCode}`)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30">Force close</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );

  const renderExplorer = () => {
    const rows = Array.from(facultyGroups.entries()).flatMap(([facultyName, departmentSet]) => Array.from(departmentSet).map((department) => {
      const courses = data.courses.filter((course) => course.department === department);
      const courseIds = new Set(courses.map((course) => course.id));
      const sessions = data.sessions.filter((session) => courseIds.has(session.courseId));
      const courseRecords = data.records.filter((record) => courseIds.has(record.courseId));
      const members = data.userProfiles.filter((profile) => profile.department === department);
      const below = data.students.filter((student) => student.department === department && student.attendanceRate < 75).length;
      const live = sessions.filter((session) => effectiveStatus(session, now) === 'live').length;
      const expected = sessions.reduce((total, session) => total + (session.maxStudents ?? coursesById.get(session.courseId)?.enrolledStudentCount ?? 0), 0);
      const attendance = expected ? Math.min(100, Math.round(courseRecords.length / expected * 100)) : 0;
      return { faculty: facultyName, department, students: members.filter((person) => person.role === 'student').length, courses: courses.length, sessions: sessions.length, rate: attendance, live, below };
    }));
    return <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600"><Building2 className="h-4 w-4" />Department comparison across {facultyGroups.size} faculties</div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Faculty', 'Department', 'Students', 'Courses', 'Sessions held', 'Avg attendance', 'Live now', 'Below 75%'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => {
        const departmentCourses = data.courses.filter((course) => course.department === row.department);
        return <React.Fragment key={row.department}><tr><td className="px-4 py-3">{row.faculty}</td><td className="px-4 py-3 font-semibold"><button onClick={() => setExpandedDepartment((previous) => previous === row.department ? null : row.department)} className="text-left text-indigo-700 underline-offset-2 hover:underline">{expandedDepartment === row.department ? '− ' : '+ '}{row.department}</button></td><td className="px-4 py-3">{row.students}</td><td className="px-4 py-3">{row.courses}</td><td className="px-4 py-3">{row.sessions}</td><td className="px-4 py-3">{row.rate}%</td><td className="px-4 py-3">{row.live}</td><td className="px-4 py-3">{row.below}</td></tr>{expandedDepartment === row.department && <tr><td colSpan={8} className="bg-slate-50 px-5 py-3"><p className="mb-2 text-xs font-extrabold uppercase text-slate-500">Courses · {row.department}</p><div className="space-y-2">{departmentCourses.map((course) => <div key={course.id} className="rounded-lg border border-slate-200 bg-white p-3"><button onClick={() => setExpandedCourseId((previous) => previous === course.id ? null : course.id)} className="text-sm font-bold text-indigo-700 underline-offset-2 hover:underline">{course.code} · {course.title}</button>{expandedCourseId === course.id && <div className="mt-2 space-y-1">{data.sessions.filter((session) => session.courseId === course.id).map((session) => <button key={session.id} onClick={() => { setSelectedEvidenceRecordId(null); setSelectedSession(session); }} className="block w-full rounded-md bg-slate-50 px-3 py-2 text-left text-xs hover:bg-indigo-50">{session.courseCode} · {effectiveStatus(session, now)} · {new Date(session.startTime).toLocaleString()} · {recordsBySession.get(session.id)?.length ?? 0} check-ins — open student records</button>)}</div>}</div>)}{departmentCourses.length === 0 && <p className="text-xs text-slate-500">No courses are registered for this department.</p>}</div></td></tr>}</React.Fragment>;
      })}</tbody></table></div>
      {rows.length === 0 && <EmptyState message="No faculty and department data is available. Seed the demo dataset or populate Firebase." />}
      <p className="text-xs text-slate-500">Expand a department, then a course, to open sessions and inspect their student records.</p>
    </section>;
  };

  const renderPeople = () => {
    const people = data.userProfiles.filter((person) => !normalizedQuery ||
      [person.fullName, person.email, person.department, person.faculty, person.level, person.role].some((value) => value?.toLowerCase().includes(normalizedQuery)));
    return <section className="space-y-3">
      <label className="relative block max-w-lg"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, faculty or department" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></label>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Name', 'Role', 'Faculty', 'Department', 'Level', 'Last active', 'Attendance', 'Account'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{people.map((person) => {
        const student = data.students.find((item) => item.id === person.id);
        const lastActive = data.auditLog.find((entry) => entry.actorId === person.id);
        return <tr key={person.id} className="hover:bg-slate-50"><td className="px-4 py-3"><button onClick={() => student && setSelectedStudent(student)} className="text-left font-semibold text-indigo-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500/30">{person.fullName}<span className="block text-xs font-normal text-slate-500">{person.email}</span></button></td><td className="px-4 py-3">{person.role}</td><td className="px-4 py-3">{person.faculty || '—'}</td><td className="px-4 py-3">{person.department || '—'}</td><td className="px-4 py-3">{person.level || '—'}</td><td className="px-4 py-3">{lastActive ? new Date(lastActive.timestamp).toLocaleString() : '—'}</td><td className="px-4 py-3">{student ? `${student.attendanceRate}%` : '—'}</td><td className="px-4 py-3"><button onClick={() => openReasonDialog(person.active === false ? 'account_reactivate' : 'account_deactivate', person.id, `${person.active === false ? 'Reactivate' : 'Deactivate'} ${person.fullName}`)} disabled={person.id === currentUser.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-40">{person.active === false ? 'Inactive · Reactivate' : 'Active · Deactivate'}</button></td></tr>;
      })}</tbody></table></div>
      {people.length === 0 && <EmptyState message="No people match this search." />}
    </section>;
  };

  const renderActivity = () => {
    const logs = data.auditLog.filter((entry) =>
      (auditActor === 'all' || entry.actorId === auditActor) &&
      (auditRole === 'all' || entry.actorRole === auditRole) &&
      (auditAction === 'all' || entry.action === auditAction) &&
      (!auditStartDate || entry.timestamp.slice(0, 10) >= auditStartDate) &&
      (!auditEndDate || entry.timestamp.slice(0, 10) <= auditEndDate)
    );
    return <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SelectFilter label="Actor" value={auditActor} onChange={setAuditActor} values={Array.from(new Set(data.auditLog.map((entry) => entry.actorId)))} labels={Object.fromEntries(data.auditLog.map((entry) => [entry.actorId, entry.actorName]))} />
        <SelectFilter label="Role" value={auditRole} onChange={setAuditRole} values={Array.from(new Set(data.auditLog.map((entry) => entry.actorRole)))} />
        <SelectFilter label="Action" value={auditAction} onChange={setAuditAction} values={Array.from(new Set(data.auditLog.map((entry) => entry.action)))} />
        <label className="text-[10px] font-bold uppercase text-slate-500">From<input aria-label="Activity start date" type="date" value={auditStartDate} onChange={(event) => setAuditStartDate(event.target.value)} className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-bold uppercase text-slate-500">To<input aria-label="Activity end date" type="date" value={auditEndDate} onChange={(event) => setAuditEndDate(event.target.value)} className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-xs normal-case" /></label>
        <button onClick={() => csvDownload('uniuyo-audit-log.csv', [['Timestamp', 'Actor', 'Role', 'Action', 'Target type', 'Target ID', 'Details'], ...logs.map((entry) => [entry.timestamp, entry.actorName, entry.actorRole, entry.action, entry.targetType, entry.targetId, entry.details])])} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"><Download className="h-4 w-4" />Export CSV</button>
      </div>
      <ol className="space-y-2">{logs.map((entry) => <li key={entry.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" /><div className="min-w-0"><p className="text-sm font-semibold">{entry.action} <span className="font-normal text-slate-500">· {entry.targetType} {entry.targetId}</span></p><p className="text-xs text-slate-500">{entry.actorName} ({entry.actorRole}) · {new Date(entry.timestamp).toLocaleString()}</p><p className="mt-1 break-words text-xs text-slate-600">{entry.details}</p></div></li>)}</ol>
      {logs.length === 0 && <EmptyState message="No activity has been recorded yet." />}
    </section>;
  };

  const alerts = useMemo(() => {
    const result: { id: string; severity: string; title: string; evidence: string; sessionId?: string; recordId?: string }[] = [];
    const accuracyThreshold = Number(data.appConfig.find((entry) => entry.id === 'devSettings')?.maxGpsAccuracyMeters ?? 50);
    const addAlert = (severity: string, title: string, evidence: string, sessionId?: string, recordId?: string) => {
      const id = `alert_${`${title}_${evidence}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 120)}`;
      result.push({ id, severity, title, evidence, sessionId, recordId });
    };
    const fingerprints = new Map<string, Set<string>>();
    const coordinates = new Map<string, number>();
    for (const record of data.records) {
      if (record.deviceFingerprint) {
        const people = fingerprints.get(record.deviceFingerprint) ?? new Set<string>();
        people.add(record.studentId);
        fingerprints.set(record.deviceFingerprint, people);
      }
      const key = `${record.latitude.toFixed(5)},${record.longitude.toFixed(5)}`;
      coordinates.set(key, (coordinates.get(key) ?? 0) + 1);
      if (record.locationAccuracyMeters > accuracyThreshold) addAlert('high', 'GPS accuracy exceeded threshold', `${record.studentName} · ${record.locationAccuracyMeters} m accuracy`, record.sessionId, record.id);
    }
    for (const [fingerprint, people] of fingerprints) if (people.size > 1) {
      const record = data.records.find((item) => item.deviceFingerprint === fingerprint);
      addAlert('high', 'Device fingerprint shared by multiple students', `${people.size} students · ${fingerprint}`, record?.sessionId, record?.id);
    }
    for (const [point, count] of coordinates) if (count > 2) {
      const record = data.records.find((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}` === point);
      addAlert('medium', 'Repeated identical check-in coordinates', `${count} records · ${point}`, record?.sessionId, record?.id);
    }
    for (const session of data.sessions) {
      const duration = (Date.parse(session.endTime) - Date.parse(session.startTime)) / 60000;
      if (duration < 10 || duration > 240) addAlert('medium', 'Unusual session duration', `${session.courseCode} · ${Math.round(duration)} minutes`, session.id);
      const edgeChecks = (recordsBySession.get(session.id) ?? []).filter((record) => record.distanceFromClassMeters >= session.radiusMeters * 0.9);
      if (edgeChecks.length) addAlert('low', 'Check-ins near geofence boundary', `${session.courseCode} · ${edgeChecks.length} records at ≥90% of radius`, session.id, edgeChecks[0]?.id);
    }
    const openedCourseIds = new Set(data.sessions.map((session) => session.courseId));
    for (const entry of data.timetable) {
      const course = data.courses.find((item) => item.code === entry.courseCode && item.department === entry.department);
      if (course && !openedCourseIds.has(course.id)) addAlert('medium', 'Scheduled course has no recorded sessions', `${entry.courseCode} · ${entry.department}`);
    }
    for (const lecturer of data.userProfiles.filter((profile) => profile.role === 'lecturer')) {
      const scheduledCourses = data.courses.filter((course) =>
        course.department === lecturer.department &&
        data.timetable.some((entry) => entry.department === course.department && entry.courseCode === course.code)
      );
      for (const course of scheduledCourses) {
        const openedByLecturer = data.sessions.some((session) =>
          session.courseId === course.id && session.lecturerId === lecturer.id
        );
        if (!openedByLecturer) addAlert('medium', 'Scheduled lecturer has not opened a session', `${lecturer.fullName} · ${course.code} · ${course.department}`);
      }
    }
    return result;
  }, [data.records, data.sessions, data.timetable, data.courses, data.appConfig, recordsBySession]);

  const renderAnomalies = () => <section className="space-y-3">
    {alerts.map((alert) => {
      const state = data.integrityAlerts.find((item) => item.id === alert.id)?.status;
      return <article key={alert.id} className="flex flex-wrap gap-3 rounded-xl border border-amber-200 bg-white p-4"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">{alert.severity}</span><h3 className="mt-2 text-sm font-bold">{alert.title}</h3><p className="mt-1 break-all text-xs text-slate-600">{alert.evidence}</p>{alert.sessionId && <button onClick={() => { setSelectedEvidenceRecordId(alert.recordId ?? null); setSelectedSession(data.sessions.find((session) => session.id === alert.sessionId) ?? null); }} className="mt-2 text-xs font-bold text-indigo-700 underline underline-offset-2">View session evidence</button>}{state && <p className="mt-2 text-xs font-bold uppercase text-indigo-700">{state}</p>}</div><div className="flex gap-2"><button onClick={() => openReasonDialog('alert_acknowledge', alert.id, `Acknowledge: ${alert.title}`)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold">Acknowledge</button><button onClick={() => openReasonDialog('alert_resolve', alert.id, `Resolve: ${alert.title}`)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold">Resolve</button></div></article>;
    })}
    {alerts.length === 0 && <EmptyState message="No integrity anomalies were detected in the currently loaded dataset." />}
    <p className="text-xs text-slate-500">Alert status changes are persisted with a written reason in the institution audit log.</p>
  </section>;

  const renderAnalytics = () => {
    const hours = new Map<string, number>();
    const rooms = new Map<string, number>();
    for (const session of data.sessions) {
      const hour = new Date(session.startTime).getHours().toString().padStart(2, '0');
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
      rooms.set(session.locationName, (rooms.get(session.locationName) ?? 0) + 1);
    }
    const allRate = attendanceCoverage(data.records, data.sessions);
    const trend = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (5 - index) * 7 - 6);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const weeklySessions = data.sessions.filter((session) => {
        const started = Date.parse(session.startTime);
        return started >= start.getTime() && started < end.getTime();
      });
      const sessionIds = new Set(weeklySessions.map((session) => session.id));
      const weeklyRecords = data.records.filter((record) => sessionIds.has(record.sessionId));
      return {
        label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rate: attendanceCoverage(weeklyRecords, weeklySessions)
      };
    });
    const rows = [
      ['Institution people', String(data.userProfiles.length)],
      ['Courses', String(data.courses.length)],
      ['Sessions opened', String(data.sessions.length)],
      ['Mean check-in rate', `${allRate}%`],
      ['Open live sessions', String(data.sessions.filter((session) => effectiveStatus(session, now) === 'live').length)],
      ['Expired but not closed', String(data.sessions.filter((session) => effectiveStatus(session, now) === 'expired-but-not-closed').length)]
    ];
    return <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{rows.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Lecturer compliance · scheduled vs opened</h3>{data.userProfiles.filter((user) => user.role === 'lecturer').map((lecturer) => { const assigned = data.courses.filter((course) => course.department === lecturer.department); const opened = assigned.filter((course) => data.sessions.some((session) => session.courseId === course.id)).length; return <p key={lecturer.id} className="mt-2 flex justify-between text-sm"><span>{lecturer.fullName} · {lecturer.department}</span><span>{opened} / {assigned.length} courses</span></p>; })}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Peak lecture hours</h3>{[...hours].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hour, count]) => <p key={hour} className="mt-2 flex justify-between text-sm"><span>{hour}:00</span><span>{count} sessions</span></p>)}</div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Room utilization (sessions held)</h3>{[...rooms].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([room, count]) => <p key={room} className="mt-2 flex justify-between text-sm"><span>{room}</span><span>{count} sessions</span></p>)}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Six-week attendance coverage trend</h3><div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">{trend.map((item) => <div key={item.label}><div className="flex h-24 items-end rounded-lg bg-slate-50"><div className="w-full rounded-lg bg-indigo-500" style={{ height: `${Math.max(item.rate, 2)}%` }} /></div><p className="mt-1 text-center text-[10px] text-slate-500">{item.label}</p><p className="text-center text-xs font-bold">{item.rate}%</p></div>)}</div></div>
      <button onClick={() => { window.print(); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Print management report</button>
      <button onClick={() => csvDownload('uniuyo-management-report.csv', [['Metric', 'Value'], ...rows])} className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Download className="h-4 w-4" />Export CSV</button>
    </section>;
  };

  const renderSystem = () => {
    const settings = data.appConfig.find((entry) => entry.id === 'devSettings');
    const jsonBytes = new Blob([JSON.stringify(data)]).size;
    const setNumber = (key: 'minRadiusMeters' | 'maxGpsAccuracyMeters' | 'lateThresholdMinutes' | 'pinLength', value: number) => setConfig((previous) => ({ ...previous, [key]: value }));
    return <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 font-bold"><Settings2 className="h-4 w-4 text-indigo-600" />Institution-wide defaults</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NumberSetting label="Minimum geofence radius (m)" value={config.minRadiusMeters} onChange={(value) => setNumber('minRadiusMeters', value)} />
          <NumberSetting label="Maximum GPS accuracy (m)" value={config.maxGpsAccuracyMeters} onChange={(value) => setNumber('maxGpsAccuracyMeters', value)} />
          <NumberSetting label="Late threshold (minutes)" value={config.lateThresholdMinutes} onChange={(value) => setNumber('lateThresholdMinutes', value)} />
          <NumberSetting label="Session PIN length" value={config.pinLength} onChange={(value) => setNumber('pinLength', value)} />
          <label className="text-xs font-semibold text-slate-700">Current semester<input value={config.semesterName} onChange={(event) => setConfig((previous) => ({ ...previous, semesterName: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></label>
        </div>
        <div className="mt-4 space-y-2 text-sm"><label className="flex gap-2"><input type="checkbox" checked={config.featureFlags.anomalyAlerts} onChange={(event) => setConfig((previous) => ({ ...previous, featureFlags: { ...previous.featureFlags, anomalyAlerts: event.target.checked } }))} />Enable anomaly alerts</label><label className="flex gap-2"><input type="checkbox" checked={config.featureFlags.managementBroadcasts} onChange={(event) => setConfig((previous) => ({ ...previous, featureFlags: { ...previous.featureFlags, managementBroadcasts: event.target.checked } }))} />Enable management broadcasts</label></div>
        <button onClick={() => openReasonDialog('save_config', 'devSettings', 'Save institution settings')} className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Save settings (reason required)</button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Data health</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">{Object.entries(data).map(([key, value]) => <p key={key} className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{key}</span><strong>{Array.isArray(value) ? value.length : 1}</strong> items</p>)}</div><p className="mt-3 text-xs text-slate-500">Loaded payload size: {Math.round(jsonBytes / 1024)} KB · Config document {settings ? 'present' : 'not configured'}</p><p className="mt-2 text-xs text-amber-700">This is an estimate of the current response payload, not Firebase's authoritative storage usage.</p></div>
      <div className="rounded-2xl border border-rose-200 bg-white p-5"><h3 className="font-bold text-rose-800">Reset demo data</h3><p className="mt-1 text-sm text-slate-600">Remove only records explicitly marked as demo seed data. This is available only when the project has demo mode enabled.</p><button disabled={settings?.demoMode !== true} onClick={() => openReasonDialog('reset_demo', 'demoData', 'Reset seeded demo data')} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Reset demo data</button>{settings?.demoMode !== true && <p className="mt-2 text-xs text-slate-500">Demo mode is not enabled for this Firebase project.</p>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Faculty announcements</h3><p className="mt-1 text-sm text-slate-600">Broadcast through existing notification records. A reason and server confirmation are required.</p><button onClick={() => { setBroadcast({ scope: 'everyone', scopeValue: '', title: '', body: '' }); openReasonDialog('broadcast', 'everyone', 'Broadcast announcement'); }} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Compose announcement</button></div>
    </section>;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dev_explorer': return renderExplorer();
      case 'dev_people': return renderPeople();
      case 'dev_activity': return renderActivity();
      case 'dev_anomalies': return renderAnomalies();
      case 'dev_analytics': return renderAnalytics();
      case 'dev_system': return renderSystem();
      default: return renderLiveOperations();
    }
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-slate-50 p-4 sm:p-6">
      <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-700"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Dev / Management Console</p><h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{pageTitle}</h2><p className="mt-1 text-sm text-slate-600">Institution-wide, read-oriented monitoring · controlled actions require a written reason.</p></div>
      <button onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {loading && data.sessions.length === 0 ? <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading institution data…</div> : renderContent()}
    {selectedSession && <SessionDetails session={selectedSession} records={recordsBySession.get(selectedSession.id) ?? []} initialRecordId={selectedEvidenceRecordId} onClose={() => { setSelectedSession(null); setSelectedEvidenceRecordId(null); }} onForceClose={() => openReasonDialog('force_close', selectedSession.id, `Force-close ${selectedSession.courseCode}`)} onRecordAction={(action, record) => openReasonDialog(action, record.id, `${action.replace('record_', '')} ${record.studentName}'s attendance`)} />}
    {selectedStudent && <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    {pendingAction && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="dev-action-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 id="dev-action-title" className="text-lg font-black">{pendingAction.label}</h3><p className="mt-1 text-sm text-slate-600">This action is logged in the audit trail and cannot be silently undone.</p></div><button aria-label="Close confirmation" onClick={() => setPendingAction(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>{pendingAction.action === 'broadcast' && <div className="mt-4 space-y-3"><label className="block text-xs font-bold">Audience<select value={broadcast.scope} onChange={(event) => setBroadcast((previous) => ({ ...previous, scope: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2"><option value="everyone">Everyone</option><option value="faculty">Faculty</option><option value="department">Department</option><option value="level">Level</option></select></label>{broadcast.scope !== 'everyone' && <label className="block text-xs font-bold">Audience value<input value={broadcast.scopeValue} onChange={(event) => setBroadcast((previous) => ({ ...previous, scopeValue: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Exact faculty, department or level" /></label>}<label className="block text-xs font-bold">Notification title<input value={broadcast.title} onChange={(event) => setBroadcast((previous) => ({ ...previous, title: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="block text-xs font-bold">Message<textarea rows={3} value={broadcast.body} onChange={(event) => setBroadcast((previous) => ({ ...previous, body: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label></div>}<label className="mt-4 block text-xs font-bold text-slate-700">Written reason<textarea autoFocus={pendingAction.action !== 'broadcast'} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Explain why this override is required." /></label>{pendingAction.action === 'save_config' && <p className="mt-2 text-xs text-slate-500">Updated values are validated by the trusted server.</p>}{pendingAction.action === 'reset_demo' && <label className="mt-3 block text-xs font-bold">Type RESET DEMO DATA<input id="reset-confirmation" className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>}{actionError && <p role="alert" className="mt-2 text-sm text-rose-700">{actionError}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setPendingAction(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Cancel</button><button onClick={async () => { if (reason.trim().length < 8) { setActionError('Write a reason of at least 8 characters.'); return; } if (pendingAction.action === 'save_config') { setBusy(true); setActionError(null); try { await runDevAdminAction({ action: 'save_config', targetId: 'devSettings', reason: reason.trim(), config }); setPendingAction(null); onActionComplete(); } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Unable to save configuration.'); } finally { setBusy(false); } } else if (pendingAction.action === 'reset_demo') { const input = document.getElementById('reset-confirmation') as HTMLInputElement | null; if (input?.value !== 'RESET DEMO DATA') { setActionError('Type RESET DEMO DATA exactly to confirm.'); return; } setBusy(true); try { await runDevAdminAction({ action: 'reset_demo', targetId: 'demoData', reason: reason.trim(), confirmation: input.value }); setPendingAction(null); onActionComplete(); } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Unable to reset demo data.'); } finally { setBusy(false); } } else { await confirmAction(); } }} disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Working…' : <><Check className="mr-1 inline h-4 w-4" />Confirm action</>}</button></div></div></div>}
  </div>;
};

const Metric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>;
const EmptyState: React.FC<{ message: string }> = ({ message }) => <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{message}</div>;
const DataPoint: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 truncate font-semibold">{value}</dd></div>;
const StatusPill: React.FC<{ status: SessionState }> = ({ status }) => <span className={`h-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${status === 'live' ? 'bg-emerald-100 text-emerald-800' : status === 'expired-but-not-closed' ? 'bg-amber-100 text-amber-800' : status === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-800'}`}>{status}</span>;
const SelectFilter: React.FC<{ label: string; value: string; onChange: (value: string) => void; values: string[]; labels?: Record<string, string> }> = ({ label, value, onChange, values, labels = {} }) => <label className="text-[10px] font-bold uppercase text-slate-500">{label}<select aria-label={`Filter by ${label}`} value={value} onChange={(event) => onChange(event.target.value)} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium normal-case text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"><option value="all">All</option>{values.filter(Boolean).map((item) => <option key={item} value={item}>{labels[item] ?? item}</option>)}</select></label>;
const NumberSetting: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <label className="text-xs font-semibold text-slate-700">{label}<input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></label>;

const SessionDetails: React.FC<{ session: AttendanceSession; records: AttendanceRecord[]; initialRecordId: string | null; onClose: () => void; onForceClose: () => void; onRecordAction: (action: string, record: AttendanceRecord) => void }> = ({ session, records, initialRecordId, onClose, onForceClose, onRecordAction }) => {
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    () => records.find((record) => record.id === initialRecordId) ?? null
  );
  const verification: GeofenceVerification | null = selectedRecord ? {
    isWithinGeofence: selectedRecord.distanceFromClassMeters <= session.radiusMeters,
    distanceMeters: selectedRecord.distanceFromClassMeters,
    radiusMeters: session.radiusMeters,
    accuracyMeters: selectedRecord.locationAccuracyMeters,
    isAccuracyAcceptable: selectedRecord.locationAccuracyMeters <= 50,
    isLate: selectedRecord.status === 'late',
    statusState: selectedRecord.locationAccuracyMeters > 50 ? 'poor_accuracy' : selectedRecord.distanceFromClassMeters > session.radiusMeters ? 'outside' : selectedRecord.status === 'late' ? 'late' : 'inside',
    message: selectedRecord.status
  } : null;
  return <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/50" role="presentation"><aside role="dialog" aria-modal="true" aria-labelledby="session-detail-title" className="h-full w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-2xl sm:p-6"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-indigo-700">Session detail</p><h3 id="session-detail-title" className="mt-1 text-xl font-black">{session.courseCode} · {session.courseTitle}</h3></div><button aria-label="Close session detail" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X /></button></div><div className="my-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs"><span>{session.locationName}</span><span>{session.radiusMeters}m radius</span><span>{session.department}</span><span>{new Date(session.startTime).toLocaleString()}</span></div><h4 className="font-bold">Check-in feed ({records.length})</h4>{records.length ? <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Student</th><th className="p-2">Status</th><th className="p-2">Distance / Accuracy</th><th className="p-2">Device fingerprint</th><th className="p-2">Time</th><th className="p-2">Controlled action</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-slate-100"><td className="p-2"><button onClick={() => setSelectedRecord(record)} className="font-semibold text-indigo-700 underline-offset-2 hover:underline">{record.studentName}</button></td><td className="p-2">{record.voidedAt ? 'voided' : record.integrityFlag ? 'flagged' : record.status}</td><td className="p-2">{record.distanceFromClassMeters}m / ±{record.locationAccuracyMeters}m</td><td className="p-2 font-mono">{record.deviceFingerprint || 'not supplied'}</td><td className="p-2">{new Date(record.submittedAt).toLocaleTimeString()}</td><td className="p-2"><div className="flex gap-1"><button onClick={() => onRecordAction('record_flag', record)} className="rounded border px-1.5 py-1">Flag</button><button onClick={() => onRecordAction('record_annotate', record)} className="rounded border px-1.5 py-1">Annotate</button><button disabled={Boolean(record.voidedAt)} onClick={() => onRecordAction('record_void', record)} className="rounded border px-1.5 py-1 disabled:opacity-40">Void</button></div></td></tr>)}</tbody></table></div> : <EmptyState message="No students have checked in yet." />}<div className="mt-6"><h4 className="font-bold">Geofence</h4><p className="mt-1 text-xs text-slate-500">Select a student above to inspect the recorded distance and GPS accuracy.</p><div className="mx-auto mt-3 max-w-sm"><RadiusGauge verification={verification} allowedRadius={session.radiusMeters} /></div></div>{effectiveStatus(session, Date.now()) === 'live' && <button onClick={onForceClose} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Force close session</button>}</aside></div>;
};
