import React from 'react';
import { Home, Bell, Clock, ShieldCheck, Compass, Sun, Moon, Check } from 'lucide-react';
import { NavTab, User, ThemeMode } from '../types';
import { getInitials } from '../lib/avatar';

export interface MobileNavProps {
  currentUser: User;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeSessionCount: number;
  unreadNotificationsCount: number;
  onOpenCheckIn: () => void;
  isRepAdmin: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenAccountMenu: () => void;
}

export type XMobileNavProps = MobileNavProps;

export const MobileNav: React.FC<MobileNavProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  activeSessionCount,
  unreadNotificationsCount,
  onOpenCheckIn,
  isRepAdmin,
  themeMode,
  onToggleTheme,
  onOpenAccountMenu
}) => {
  const isDark = themeMode === 'lights_out';

  return (
    <>
      {/* Mobile Top App Bar (sticky at top) */}
      <header
        className={`md:hidden sticky top-0 z-30 px-4 h-13 border-b flex items-center justify-between backdrop-blur-md ${
          isDark ? 'bg-black/85 border-[#2F3336]' : 'bg-white/85 border-[#EFF3F4]'
        }`}
      >
        <button
          onClick={onOpenAccountMenu}
          className="relative cursor-pointer"
          title="Account Menu"
        >
          <span
            aria-label={currentUser.fullName}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#008751]/40 bg-[#008751] text-[10px] font-black text-white"
          >
            {getInitials(currentUser.fullName)}
          </span>
          {isRepAdmin && (
            <span className="w-3 h-3 rounded-full bg-[#1D9BF0] border border-black text-white flex items-center justify-center absolute -bottom-0.5 -right-0.5">
              <Check className="w-2 h-2" />
            </span>
          )}
        </button>

        {/* Center Logo */}
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onTabChange('home')}>
          <img
            src="/assets/uniuyo-logo.png"
            alt="University of Uyo logo"
            className="h-7 w-7 rounded-lg border border-[#008751]/20 bg-white p-0.5 object-contain"
          />
          <span className={`font-black tracking-tight text-sm ${isDark ? 'text-white' : 'text-black'}`}>
            Uniuyo Pulse
          </span>
        </div>

        {/* Theme Toggle in Header */}
        <button
          onClick={onToggleTheme}
          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
            isDark ? 'text-[#FFD400] hover:bg-[#181818]' : 'text-[#536471] hover:bg-[#EFF3F4]'
          }`}
          title="Toggle Lights Out / Light"
        >
          {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      </header>

      {/* Floating Check-In Action Button (FAB) on Mobile */}
      <div className="md:hidden fixed bottom-17 right-4 z-40">
        <button
          onClick={onOpenCheckIn}
          className="w-13 h-13 rounded-full bg-[#1D9BF0] text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer border-2 border-black"
          title="Check In with GPS"
        >
          <Compass className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Bottom Tab Bar (fixed at bottom, icon-first with minimal labels, exactly like X) */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-30 h-13 border-t flex items-center justify-around px-2 backdrop-blur-md select-none ${
          isDark ? 'bg-black/90 border-[#2F3336]' : 'bg-white/90 border-[#EFF3F4]'
        }`}
      >
        {/* Home with Live Class Indicator */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors relative ${
            activeTab === 'home'
              ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              : 'text-[#71767B]'
          }`}
          title={activeSessionCount > 0 ? `${activeSessionCount} live class in progress` : 'Home'}
        >
          <div className="relative flex flex-col items-center">
            <Home className={`w-6 h-6 ${activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
            {activeSessionCount > 0 && (
              <span className="absolute -top-0.5 -right-1.5 flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00BA7C] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00BA7C] border border-black"></span>
              </span>
            )}
          </div>
        </button>

        {/* Notifications */}
        <button
          onClick={() => onTabChange('notifications')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors relative ${
            activeTab === 'notifications'
              ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              : 'text-[#71767B]'
          }`}
        >
          <Bell className={`w-6 h-6 ${activeTab === 'notifications' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
          {unreadNotificationsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#1D9BF0] absolute top-2 right-1/3" />
          )}
        </button>

        {/* Attendance Timeline History */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
            activeTab === 'history'
              ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              : 'text-[#71767B]'
          }`}
        >
          <Clock className={`w-6 h-6 ${activeTab === 'history' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
        </button>

        {/* Rep Admin Console if rep */}
        {isRepAdmin && (
          <button
            onClick={() => onTabChange('admin_dashboard')}
            className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
              activeTab === 'admin_dashboard'
                ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                : 'text-[#71767B]'
            }`}
          >
            <ShieldCheck className={`w-6 h-6 ${activeTab === 'admin_dashboard' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
          </button>
        )}
      </nav>
    </>
  );
};

export const XMobileNav = MobileNav;
