import React from 'react';
import {
  Search,
  MapPin,
  Radio,
  Calendar,
  Sun,
  Moon,
  ShieldAlert,
  CheckCircle2,
  Volume2,
  VolumeX,
  Compass
} from 'lucide-react';
import { AttendanceSession, TimetableEntry, ThemeMode } from '../types';
import { soundManager } from '../lib/sound';

export interface RightSidebarProps {
  activeSessions: AttendanceSession[];
  timetable: TimetableEntry[];
  onSelectSession: (session: AttendanceSession) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export type XRightSidebarProps = RightSidebarProps;

export const RightSidebar: React.FC<RightSidebarProps> = ({
  activeSessions,
  timetable,
  onSelectSession,
  themeMode,
  onToggleTheme
}) => {
  const isDark = themeMode === 'lights_out';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [soundEnabled, setSoundEnabled] = React.useState(() => soundManager.isEnabled());

  const handleToggleSound = () => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  };

  const filteredSessions = activeSessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.courseCode.toLowerCase().includes(q) ||
      s.courseTitle.toLowerCase().includes(q) ||
      s.locationName.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-80 xl:w-88 shrink-0 py-3 px-4 hidden lg:flex flex-col gap-4">
      {/* Search Input Bar (Pill) */}
      <div className="relative sticky top-0 z-10 pt-1 pb-2">
        <Search className="w-4.5 h-4.5 absolute left-3.5 top-5.5 text-[#71767B]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search courses, venues, or sessions"
          className={`w-full pl-11 pr-4 py-2.5 rounded-full text-sm outline-none transition-all ${
            isDark
              ? 'bg-[#202327] text-[#E7E9EA] placeholder-[#71767B] focus:bg-[#000000] focus:ring-1 focus:ring-[#1D9BF0]'
              : 'bg-[#EFF3F4] text-[#0F1419] placeholder-[#536471] focus:bg-[#FFFFFF] focus:ring-1 focus:ring-[#1D9BF0]'
          }`}
        />
      </div>

      {/* Active University Geofences / Live Sessions Card */}
      <div
        className={`rounded-2xl p-4 border ${
          isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#1D9BF0] animate-pulse" />
            <h3 className={`font-black text-base ${isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'}`}>
              Live Geofences
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#1D9BF0] bg-[#1D9BF0]/15 px-2 py-0.5 rounded-full">
            {activeSessions.length} Active
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-[#71767B]">
              No active attendance geofences right now. Check today's schedule below.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  soundManager.playClick();
                  onSelectSession(session);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#000000] border-[#2F3336] hover:border-[#1D9BF0]'
                    : 'bg-[#FFFFFF] border-[#EFF3F4] hover:border-[#1D9BF0]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-[#1D9BF0] block font-mono">
                      {session.courseCode}
                    </span>
                    <h4
                      className={`text-xs font-bold leading-tight line-clamp-1 ${
                        isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                      }`}
                    >
                      {session.courseTitle}
                    </h4>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00BA7C]/15 text-[#00BA7C] border border-[#00BA7C]/30 shrink-0">
                    LIVE
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#71767B]">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[#1D9BF0]" />
                  <span className="truncate">{session.locationName.split(',')[0]}</span>
                  <span>·</span>
                  <span className="font-mono">{session.radiusMeters}m</span>
                </div>

                <div className="mt-2 pt-2 border-t border-[#2F3336]/40 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#71767B]">
                    Closes in{' '}
                    {Math.max(
                      1,
                      Math.round((new Date(session.endTime).getTime() - Date.now()) / 60000)
                    )}
                    m
                  </span>
                  <span className="text-xs font-bold text-[#1D9BF0]">Check In →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campus GPS Telemetry Trust Indicator */}
      <div
        className={`rounded-2xl p-3.5 border text-xs font-mono space-y-1.5 ${
          isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
        }`}
      >
        <div className="flex items-center justify-between text-[#71767B] text-[10px] uppercase font-bold">
          <span>Campus GPS Anchor</span>
          <span className="text-[#00BA7C] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00BA7C] animate-ping" />
            Active
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#71767B]">Target University</span>
          <span className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>UniUyo</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#71767B]">Satellite SatFix</span>
          <span className="text-[#1D9BF0] font-bold">Sub-Meter Precision</span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#2F3336]/30">
          <span className="text-[#71767B]">Sound Effects</span>
          <button
            onClick={handleToggleSound}
            className="flex items-center gap-1 text-[11px] text-[#1D9BF0] hover:underline cursor-pointer"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" /> Enabled
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" /> Muted
              </>
            )}
          </button>
        </div>
      </div>

      {/* Today's Timetable Widget */}
      <div
        className={`rounded-2xl p-4 border ${
          isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[#71767B]" />
          <h3 className={`font-black text-base ${isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'}`}>
            Today's Schedule
          </h3>
        </div>

        <div className="space-y-2">
          {timetable.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border text-xs ${
                isDark ? 'bg-[#000000]/50 border-[#2F3336]' : 'bg-[#FFFFFF] border-[#EFF3F4]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-[#1D9BF0] font-mono">{item.courseCode}</span>
                <span className="font-mono text-[#71767B] text-[11px]">{item.time}</span>
              </div>
              <p className={`font-bold mt-0.5 truncate ${isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'}`}>
                {item.courseTitle}
              </p>
              <div className="flex items-center gap-1 text-[#71767B] text-[11px] mt-1">
                <MapPin className="w-3 h-3 text-[#1D9BF0]" />
                <span className="truncate">{item.room}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Meta Credits */}
      <div className="px-2 text-[11px] text-[#71767B] space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <a href="#" className="hover:underline">Terms of Service</a>
          <span>·</span>
          <a href="#" className="hover:underline">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:underline">GPS Geofencing</a>
        </div>
        <p>© 2026 University of Uyo · Department of Computer Science</p>
      </div>
    </aside>
  );
};

export const XRightSidebar = RightSidebar;
