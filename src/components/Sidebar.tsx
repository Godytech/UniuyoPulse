import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileBarChart,
  Calendar,
  Users,
  Radio,
  Settings,
  UserCheck,
  LogOut,
  MapPin,
  Shield,
  Layers,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { User, NavTab } from '../types';
import { soundManager } from '../lib/sound';

interface SidebarProps {
  currentUser: User;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  activeSessionCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onLogout,
  activeSessionCount = 0
}) => {
  const isStaff = currentUser.role !== 'student';
  const isCourseRep = currentUser.role === 'rep_admin' ||
    currentUser.role === 'course_rep_admin' ||
    currentUser.role === 'assistant_course_rep';
  const roleLabel = currentUser.role === 'lecturer'
    ? 'Lecturer'
    : currentUser.role === 'assistant_course_rep'
      ? 'Assistant Course Rep'
      : isCourseRep
        ? 'Course Rep Admin'
        : 'Student';

  // Navigation Items defined strictly per Section 4 of the user specifications
  const studentNavItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, badge: activeSessionCount > 0 ? `${activeSessionCount} Live` : null },
    { id: 'courses' as NavTab, label: 'My Courses', icon: BookOpen },
    { id: 'records' as NavTab, label: 'Attendance Records', icon: ClipboardCheck },
    { id: 'calendar' as NavTab, label: 'Calendar', icon: Calendar },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserCheck },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const adminNavItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses' as NavTab, label: 'Courses', icon: BookOpen },
    { id: 'students' as NavTab, label: 'Students', icon: Users },
    { id: 'sessions' as NavTab, label: 'Attendance Sessions', icon: Radio, badge: activeSessionCount > 0 ? `${activeSessionCount} Live` : null },
    { id: 'records' as NavTab, label: 'Attendance Records', icon: ClipboardCheck },
    { id: 'reports' as NavTab, label: 'Reports', icon: FileBarChart },
    { id: 'calendar' as NavTab, label: 'Calendar', icon: Calendar },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserCheck },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const navItems = isStaff ? adminNavItems : studentNavItems;

  const handleSelect = (tab: NavTab) => {
    soundManager.playClick();
    onTabChange(tab);
  };

  return (
    <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/80 min-h-screen flex-col shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm p-1">
          <img src="/assets/uniuyo-logo.png" alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">Uniuyo Pulse</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">
            University of Uyo
          </p>
        </div>
      </div>

      {/* Role Indicator Banner */}
      <div className="px-5 pt-4 pb-2">
        <div className={`sidebar-role-card ${isStaff ? 'is-admin' : 'is-student'}`}>
          <div className="flex items-start gap-2.5">
            <div
              className="sidebar-role-icon mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            >
              {isStaff ? <Shield className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="sidebar-eyebrow text-[10px] font-bold uppercase tracking-[0.14em]">
                Signed in as
              </p>
              <p className="sidebar-role-title mt-1 truncate text-sm font-extrabold leading-tight">
                {roleLabel}
              </p>
              <span className="sidebar-level-badge mt-2 inline-flex max-w-full items-center rounded-lg px-2 py-1 text-[10px] font-bold">
                <span className="truncate">{currentUser.level}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'dashboard' && (activeTab === 'home' || activeTab === 'admin_dashboard')) ||
            (item.id === 'records' && activeTab === 'history');

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Geofence Status Badge & Logout */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        {/* GPS Geofence Security Card */}
        <div className="sidebar-geofence-card p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="sidebar-geofence-icon w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="sidebar-geofence-title text-xs font-bold truncate">Geofencing Active</p>
              <p className="sidebar-geofence-subtitle text-[10px]">Haversine GPS Engine</p>
            </div>
            <span className="sidebar-status-dot ml-auto" aria-label="Active" />
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onLogout();
          }}
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
