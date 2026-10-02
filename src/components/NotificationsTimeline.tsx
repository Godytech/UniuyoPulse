import React, { useState } from 'react';
import { Bell, Radio, CheckCircle2, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { AttendanceNotification, ThemeMode } from '../types';

export interface NotificationsTimelineProps {
  notifications: AttendanceNotification[];
  onMarkAllRead: () => void;
  onNotificationClick: (notification: AttendanceNotification) => void;
  themeMode: ThemeMode;
}

export type XNotificationsTimelineProps = NotificationsTimelineProps;

export const NotificationsTimeline: React.FC<NotificationsTimelineProps> = ({
  notifications,
  onMarkAllRead,
  onNotificationClick,
  themeMode
}) => {
  const isDark = themeMode === 'lights_out';
  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'sessions'>('all');

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'verified') return n.type === 'attendance_confirmed';
    if (activeTab === 'sessions') return n.type === 'session_opened';
    return true;
  });

  return (
    <div className="w-full">
      {/* Sticky Header with Title and Tab Switcher */}
      <div
        className={`sticky top-0 z-20 backdrop-blur-md border-b ${
          isDark ? 'bg-black/85 border-[#2F3336]' : 'bg-white/85 border-[#EFF3F4]'
        }`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className={`font-black text-lg sm:text-xl tracking-tight ${isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'}`}>
            Notifications
          </h2>
          <button
            onClick={onMarkAllRead}
            className="text-xs font-mono font-bold text-[#1D9BF0] hover:underline cursor-pointer"
          >
            Mark all as read
          </button>
        </div>

        {/* X-Style Sub-Tabs */}
        <div className="flex items-center border-t border-[#2F3336]/40">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'all'
                ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>All</span>
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-3 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'sessions'
                ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>Live Sessions</span>
            {activeTab === 'sessions' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            className={`flex-1 py-3 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'verified'
                ? isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>Verifications</span>
            {activeTab === 'verified' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Notifications Feed */}
      {filteredNotifs.length === 0 ? (
        <div className="py-16 px-6 text-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 stroke-[1.8px]" />
          </div>
          <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'}`}>
            Nothing to see here — yet
          </h3>
          <p className="text-sm text-[#71767B] mt-1.5 leading-relaxed">
            From new attendance broadcasts to live GPS verification notices, all your academic activity will drop here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#2F3336]/60">
          {filteredNotifs.map((notif) => {
            const isSession = notif.type === 'session_opened';
            const isVerified = notif.type === 'attendance_confirmed';
            const isSchedule = notif.type === 'schedule_change';

            return (
              <div
                key={notif.id}
                onClick={() => onNotificationClick(notif)}
                className={`p-4 transition-colors cursor-pointer flex items-start gap-3.5 relative ${
                  !notif.read
                    ? isDark
                      ? 'bg-[#16181C]/50 hover:bg-[#16181C]'
                      : 'bg-[#EFF3F4]/50 hover:bg-[#EFF3F4]'
                    : isDark
                    ? 'hover:bg-[#16181C]/30'
                    : 'hover:bg-[#F7F9F9]'
                }`}
              >
                {/* Unread Blue Pill Indicator */}
                {!notif.read && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#1D9BF0]" />
                )}

                {/* Left Category Icon */}
                <div className="shrink-0 mt-0.5">
                  {isSession && (
                    <div className="w-8 h-8 rounded-full bg-[#1D9BF0]/15 text-[#1D9BF0] flex items-center justify-center">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                  )}
                  {isVerified && (
                    <div className="w-8 h-8 rounded-full bg-[#00BA7C]/15 text-[#00BA7C] flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {isSchedule && (
                    <div className="w-8 h-8 rounded-full bg-[#FFD400]/15 text-[#FFD400] flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Notification Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-xs font-black tracking-tight ${
                        isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                      }`}
                    >
                      {notif.title}
                    </span>
                    <span className="text-[11px] text-[#71767B] font-mono shrink-0">
                      {notif.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-[#71767B] leading-relaxed line-clamp-2">
                    {notif.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const XNotificationsTimeline = NotificationsTimeline;
