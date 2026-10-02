import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  CheckCircle2,
  Radio,
  Shield,
  GraduationCap,
  ChevronDown,
  LogOut,
  Sliders,
  Check,
  User as UserIcon,
  X,
  Menu,
  Sun,
  Moon,
  Clock
} from 'lucide-react';
import { User, AttendanceNotification, NavTab, ThemeMode } from '../types';
import { soundManager } from '../lib/sound';
import { getInitials } from '../lib/avatar';

interface TopHeaderProps {
  currentUser: User;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  notifications: AttendanceNotification[];
  unreadCount: number;
  onMarkNotificationsRead: () => void;
  onSelectNotification: (notif: AttendanceNotification) => void;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  notifications,
  unreadCount,
  onMarkNotificationsRead,
  onSelectNotification,
  onLogout,
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  themeMode,
  onToggleTheme
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'home':
        return 'Dashboard';
      case 'courses':
        return currentUser.role === 'student' ? 'My Courses' : 'Course Management';
      case 'records':
      case 'history':
        return 'Attendance Records';
      case 'students':
        return 'Student Directory';
      case 'sessions':
        return 'Attendance Sessions';
      case 'reports':
        return 'Semester Reports & Analytics';
      case 'calendar':
        return 'Class & Session Calendar';
      case 'profile':
      case 'settings':
        return 'Account & Geofence Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3.5 transition-all">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1 pr-1 sm:pr-2">
          <div className="flex items-center gap-2">
            <img
              src="/assets/uniuyo-logo.png"
              alt="University of Uyo logo"
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white p-1 object-contain sm:hidden"
            />
            <h1 className="text-base sm:text-lg md:text-2xl font-black text-slate-900 tracking-tight truncate">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right: Theme Toggle + Role Switcher + Notifications + Profile Menu */}
        <div className="flex items-center flex-row flex-nowrap shrink-0 gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={themeMode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {themeMode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                soundManager.playClick();
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="relative p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                {/* Mobile tap-outside backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs sm:hidden"
                  onClick={() => setShowNotifications(false)}
                  aria-hidden="true"
                />

                {/* Dropdown Card: on mobile it is full-width with margins below the top header, on desktop it anchors to bell */}
                <div className="fixed inset-x-2.5 sm:inset-x-auto top-14 sm:top-full sm:right-0 sm:mt-2 w-auto sm:w-96 max-w-md mx-auto sm:mx-0 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[calc(100vh-72px)] sm:max-h-[520px]">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-800">Notifications</span>
                      {unreadCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          {unreadCount} new
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                          All caught up
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => {
                            soundManager.playClick();
                            onMarkNotificationsRead();
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer hover:underline px-2 py-1 rounded transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          setShowNotifications(false);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                        aria-label="Close notifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notification Items List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 overscroll-contain">
                    {notifications.length === 0 ? (
                      <div className="py-12 px-4 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">All caught up!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">No attendance alerts right now.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            soundManager.playClick();
                            onSelectNotification(n);
                            setShowNotifications(false);
                          }}
                          className={`p-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer flex items-start gap-3 ${
                            !n.read ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {n.type === 'session_opened' ? (
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center ring-2 ring-emerald-500/15">
                                <Radio className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center ring-2 ring-emerald-500/15">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.body}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-300" />
                                {n.timestamp}
                              </span>
                              {n.courseCode && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {n.courseCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                      <span>Uniuyo Pulse Alerts</span>
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          setShowNotifications(false);
                        }}
                        className="font-bold text-slate-700 hover:text-emerald-600 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User Profile Pill & Menu */}
          <div className="relative">
            <button
              onClick={() => {
                soundManager.playClick();
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shrink-0"
            >
              <span
                aria-label={currentUser.fullName}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#008751] text-[10px] font-black text-white ring-1 ring-[#006B3F]/20"
              >
                {getInitials(currentUser.fullName)}
              </span>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                  {currentUser.fullName}
                </p>
                <p className="text-[10px] text-slate-500 capitalize">
                  {currentUser.role === 'lecturer'
                    ? 'Lecturer'
                    : currentUser.role === 'assistant_course_rep'
                      ? 'Assistant Course Rep'
                      : currentUser.role === 'rep_admin' || currentUser.role === 'course_rep_admin'
                        ? 'Course Rep Admin'
                        : 'Student'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <>
                {/* Mobile tap-outside backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs sm:hidden"
                  onClick={() => setShowUserMenu(false)}
                  aria-hidden="true"
                />

                <div className="fixed right-2.5 sm:absolute sm:right-0 top-14 sm:top-full sm:mt-2 w-72 max-w-[calc(100vw-20px)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900">{currentUser.fullName}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{currentUser.studentId || currentUser.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {currentUser.department} • {currentUser.level}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        onTabChange('profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        onTabChange('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      <span>System Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-xs text-rose-600 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Mobile Navigation Drawer Hamburger Button (On the exact same horizontal straight line) */}
          <button
            onClick={() => {
              soundManager.playClick();
              if (onOpenMobileMenu) onOpenMobileMenu();
            }}
            className="lg:hidden p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-emerald-600 transition-all cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>
        </div>
      </div>
    </header>
  );
};
