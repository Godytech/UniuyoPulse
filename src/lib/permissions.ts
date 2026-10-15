import type { User, UserRole } from '../types';

export type Permission =
  | 'dev.access'
  | 'sessions.forceClose'
  | 'records.override'
  | 'notifications.broadcast'
  | 'accounts.manage'
  | 'semester.manage'
  | 'sessions.checkIn'
  | 'sessions.create'
  | 'students.assignRoles'
  | 'reports.view'
  | 'records.viewAll';

const staffRoles: UserRole[] = [
  'lecturer',
  'course_rep_admin',
  'assistant_course_rep',
  'rep_admin'
];

export function can(user: Pick<User, 'role'> | UserRole, permission: Permission): boolean {
  const role = typeof user === 'string' ? user : user.role;
  switch (permission) {
    case 'dev.access':
    case 'sessions.forceClose':
    case 'records.override':
    case 'notifications.broadcast':
    case 'accounts.manage':
      return role === 'dev_admin';
    case 'semester.manage':
    case 'reports.view':
      return staffRoles.includes(role);
    case 'sessions.checkIn':
      return role === 'student' || role === 'course_rep_admin' ||
        role === 'assistant_course_rep' || role === 'rep_admin';
    case 'sessions.create':
      return staffRoles.includes(role);
    case 'students.assignRoles':
      return role === 'lecturer';
    case 'records.viewAll':
      return role !== 'student';
  }
}

export function isDevAdmin(user: Pick<User, 'role'> | UserRole): boolean {
  return can(user, 'dev.access');
}

export function isStudent(user: Pick<User, 'role'> | UserRole): boolean {
  return !can(user, 'records.viewAll');
}

export function isLecturer(user: Pick<User, 'role'> | UserRole): boolean {
  return can(user, 'students.assignRoles');
}

export function roleLabel(user: Pick<User, 'role'> | UserRole): string {
  const role = typeof user === 'string' ? user : user.role;
  if (isDevAdmin(role)) return 'Dev / Management Console';
  if (isStudent(role)) return 'Student';
  if (role === 'lecturer') return 'Lecturer';
  if (role === 'assistant_course_rep') return 'Assistant Course Rep';
  return 'Course Rep Admin';
}
