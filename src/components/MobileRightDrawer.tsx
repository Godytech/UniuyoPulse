import React, { useEffect } from 'react';
import {
  X,
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
  ChevronRight,
  Shield,
  GraduationCap,
  Sparkles,
  MapPin,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { User, NavTab, AttendanceSession, ThemeMode } from '../types';
import { soundManager } from '../lib/sound';
import { useTimeGreeting, getTimeEmoji } from '../lib/timeGreeting';
import { getInitials } from '../lib/avatar';

interface MobileRightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  activeSessions?: AttendanceSession[];
  onOpenCheckIn?: (session: AttendanceSession) => void;
  onOpenCreateSession?: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export const MobileRightDrawer: React.FC<MobileRightDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeTab,
  onTabChange,
  onLogout,
  activeSessions = [],
  onOpenCheckIn,
  onOpenCreateSession,
  themeMode,
  onToggleTheme
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
  const activeSessionCount = activeSessions.length;
  const { greeting, period, timeString, timeZoneShort } = useTimeGreeting();
  const TimeIcon = getTimeEmoji(period);

  // Prevent background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const studentNavItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, badge: activeSessionCount > 0 ? `${activeSessionCount} Live` : null },
    { id: 'courses' as NavTab, label: 'My Courses', icon: BookOpen },
    { id: 'records' as NavTab, label: 'Attendance Records', icon: ClipboardCheck },
    { id: 'reports' as NavTab, label: 'Semester Reports', icon: FileBarChart },
    { id: 'calendar' as NavTab, label: 'Academic Calendar', icon: Calendar },
    { id: 'profile' as NavTab, label: 'My Profile', icon: UserCheck },
    { id: 'settings' as NavTab, label: 'System Settings', icon: Settings },
  ];

  const adminNavItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses' as NavTab, label: 'Course Management', icon: BookOpen },
    { id: 'students' as NavTab, label: 'Student Directory', icon: Users },
    { id: 'sessions' as NavTab, label: 'Attendance Sessions', icon: Radio, badge: activeSessionCount > 0 ? `${activeSessionCount} Live` : null },
    { id: 'records' as NavTab, label: 'Attendance Records', icon: ClipboardCheck },
    { id: 'reports' as NavTab, label: 'Semester Reports', icon: FileBarChart },
    { id: 'calendar' as NavTab, label: 'Timetable & Schedule', icon: Calendar },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserCheck },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const navItems = isStaff ? adminNavItems : studentNavItems;

  const handleItemClick = (tab: NavTab) => {
    soundManager.playClick();
    onTabChange(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right-Hand Sliding Drawer */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300 border-l border-slate-200/80">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm p-1">
              <img src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-slate-900 tracking-tight">Uniuyo Pulse</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Smart Attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label={themeMode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {themeMode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Card in Drawer */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <span
              aria-label={currentUser.fullName}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#008751] text-sm font-black text-white shadow-xs ring-2 ring-[#008751]/20"
            >
              {getInitials(currentUser.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mb-0.5">
                <span>{greeting}</span>
                <TimeIcon className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                <span className="text-slate-400 font-normal font-mono">• {timeString}</span>
              </div>
              <p className="text-xs font-black text-slate-900 truncate">{currentUser.fullName}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">{currentUser.studentId}</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold mt-1 ${
                  'bg-emerald-50 text-emerald-700'
                }`}
              >
                {isStaff ? <Shield className="w-2.5 h-2.5" /> : <GraduationCap className="w-2.5 h-2.5" />}
                <span>{roleLabel}</span>
              </span>
              <span className="block mt-1 text-[10px] font-semibold text-slate-400 truncate">
                {currentUser.level}
              </span>
            </div>
          </div>

        </div>

        {/* Navigation Items (Sections: Courses, Attendance, Students, Sessions, Reports, Calendar, Settings) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation Sections
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'dashboard' && activeTab === 'home') ||
              (item.id === 'records' && (activeTab === 'history' || activeTab === 'records'));

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#008751] text-white shadow-md shadow-[#008751]/25 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>{item.badge}</span>
                    </span>
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-white/70' : 'text-slate-300'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer Bottom Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-2">
          {/* Active Broadcast Quick Action */}
          {activeSessions.length > 0 && (currentUser.role === 'student' || isCourseRep) && onOpenCheckIn && (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenCheckIn(activeSessions[0]);
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Verify GPS Check-In Now</span>
            </button>
          )}

          {isCourseRep && onOpenCreateSession && (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenCreateSession();
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Start New Geofence Session</span>
            </button>
          )}

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
            <button
              onClick={() => {
                soundManager.playClick();
                onLogout();
                onClose();
              }}
              className="text-rose-600 font-bold hover:underline cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
