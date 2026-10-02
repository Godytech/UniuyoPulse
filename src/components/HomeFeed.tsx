import React, { useState } from 'react';
import {
  Radio,
  MapPin,
  Clock,
  Compass,
  Calendar,
  CheckCircle2,
  Users,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Share2,
  Bookmark,
  BookmarkCheck,
  Search,
  ExternalLink,
  Sliders,
  Check
} from 'lucide-react';
import { AttendanceSession, Course, TimetableEntry, User, ThemeMode, AttendanceRecord } from '../types';
import { soundManager } from '../lib/sound';
import { getInitials } from '../lib/avatar';

export interface HomeFeedProps {
  currentUser: User;
  courses: Course[];
  activeSessions: AttendanceSession[];
  timetable: TimetableEntry[];
  records: AttendanceRecord[];
  onSelectSession: (session: AttendanceSession) => void;
  onOpenCreateSession: () => void;
  onViewSlip?: (record: AttendanceRecord) => void;
  isRepAdmin: boolean;
  themeMode: ThemeMode;
}

export type XHomeFeedProps = HomeFeedProps;

export const HomeFeed: React.FC<HomeFeedProps> = ({
  currentUser,
  courses,
  activeSessions,
  timetable,
  records,
  onSelectSession,
  onOpenCreateSession,
  onViewSlip,
  isRepAdmin,
  themeMode
}) => {
  const isDark = themeMode === 'lights_out';
  const [activeTab, setActiveTab] = useState<'sessions' | 'courses' | 'timetable'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  const myCheckedInSessionMap = new Map(
    records.filter((r) => r.studentId === currentUser.id).map((r) => [r.sessionId, r])
  );

  const toggleBookmark = (sessionId: string) => {
    soundManager.playClick();
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleShareSession = (session: AttendanceSession) => {
    soundManager.playClick();
    const text = `Live Attendance Geofence open for ${session.courseCode} at ${session.locationName}. Closes in 30 mins.`;
    navigator.clipboard?.writeText(text);
    setCopiedSessionId(session.id);
    setTimeout(() => setCopiedSessionId(null), 2000);
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

  const filteredCourses = courses.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.classroom.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full">
      {/* Top Sticky Header with Tab Navigation (X-Style) */}
      <div
        className={`sticky top-0 z-20 backdrop-blur-md border-b ${
          isDark ? 'bg-black/85 border-[#2F3336]' : 'bg-white/85 border-[#EFF3F4]'
        }`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2
              className={`font-black text-lg sm:text-xl tracking-tight ${
                isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
              }`}
            >
              Home
            </h2>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 px-2.5 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{activeSessions.length} Geofences Active</span>
          </div>
        </div>

        {/* X Sub-Tabs: Active Feed, Courses, Schedule */}
        <div className="flex items-center border-t border-[#2F3336]/40">
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('sessions');
            }}
            className={`flex-1 py-3.5 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'sessions'
                ? isDark
                  ? 'text-[#E7E9EA]'
                  : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>Active Feed</span>
            {activeTab === 'sessions' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('courses');
            }}
            className={`flex-1 py-3.5 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'courses'
                ? isDark
                  ? 'text-[#E7E9EA]'
                  : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>Courses ({courses.length})</span>
            {activeTab === 'courses' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('timetable');
            }}
            className={`flex-1 py-3.5 text-center text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === 'timetable'
                ? isDark
                  ? 'text-[#E7E9EA]'
                  : 'text-[#0F1419]'
                : 'text-[#71767B] hover:text-[#E7E9EA]'
            }`}
          >
            <span>Schedule</span>
            {activeTab === 'timetable' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Main Single-Column Vertical Feed (Timeline) */}
      {activeTab === 'sessions' && (
        <div className="divide-y divide-[#2F3336]/60">
          {/* Quick Rep Broadcast Composer Strip (if user is Rep) */}
          {isRepAdmin && (
            <div
              className={`p-4 flex items-center justify-between gap-3 ${
                isDark ? 'bg-[#16181C]/40 hover:bg-[#16181C]/60' : 'bg-[#F7F9F9] hover:bg-[#EFF3F4]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-label={currentUser.fullName}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#008751]/40 bg-[#008751] text-xs font-black text-white"
                >
                  {getInitials(currentUser.fullName)}
                </span>
                <span className="text-sm text-[#71767B]">
                  Broadcast attendance to classroom geofence...
                </span>
              </div>
              <button
                onClick={onOpenCreateSession}
                className="py-2 px-5 bg-[#1D9BF0] hover:bg-[#1A8CD8] active:scale-98 text-white font-black text-xs rounded-full shadow-sm transition-all cursor-pointer shrink-0"
              >
                Broadcast
              </button>
            </div>
          )}

          {/* ACTIVE SESSIONS POST CARDS */}
          {filteredSessions.length === 0 ? (
            <div className="py-16 px-6 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] flex items-center justify-center mx-auto mb-3">
                <Radio className="w-6 h-6 stroke-[1.8px]" />
              </div>
              <h3
                className={`text-xl font-black tracking-tight ${
                  isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                }`}
              >
                No active geofences right now
              </h3>
              <p className="text-sm text-[#71767B] mt-1.5 leading-relaxed">
                When your course rep broadcasts attendance for a lecture, it will appear right here with
                live GPS distance verification.
              </p>
              {isRepAdmin && (
                <button
                  onClick={onOpenCreateSession}
                  className="mt-4 py-2.5 px-6 bg-[#EFF3F4] hover:bg-white text-[#0F1419] font-black text-xs rounded-full transition-all cursor-pointer shadow-sm"
                >
                  Start First Session
                </button>
              )}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const checkedInRecord = myCheckedInSessionMap.get(session.id);
              const hasCheckedIn = !!checkedInRecord;
              const isBookmarked = bookmarkedIds.has(session.id);
              const remainingMinutes = Math.max(
                1,
                Math.round((new Date(session.endTime).getTime() - Date.now()) / 60000)
              );

              // Attendee count for this session
              const attendeeCount = records.filter((r) => r.sessionId === session.id).length;
              const sessionCourse = courses.find((course) => course.id === session.courseId);

              return (
                <article
                  key={session.id}
                  className={`p-4 transition-colors ${
                    isDark ? 'hover:bg-[#16181C]/30' : 'hover:bg-[#F7F9F9]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Course Rep Avatar Treatment */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#1D9BF0]/15 text-[#1D9BF0] border border-[#1D9BF0]/30 font-black text-xs flex items-center justify-center">
                        {session.courseCode.slice(0, 3)}
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-[#00BA7C] border-2 border-black absolute -bottom-0.5 -right-0.5" />
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-w-0">
                      {/* Post Header: Rep Name, Course Code Handle, Timestamp */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-black text-sm truncate ${
                              isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                            }`}
                          >
                            {session.lecturerName || sessionCourse?.repName || 'Session organizer'}
                          </span>
                          <span className="w-3.5 h-3.5 rounded-full bg-[#1D9BF0] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                          <span className="text-xs text-[#71767B] font-mono">
                            @session_organizer · {new Date(session.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00BA7C]/15 text-[#00BA7C] border border-[#00BA7C]/30 shrink-0">
                          GEOFENCE ACTIVE
                        </span>
                      </div>

                      {/* Course Information */}
                      <div className="mt-1">
                        <h4
                          className={`text-base font-black tracking-tight ${
                            isDark ? 'text-[#E7E9EA]' : 'text-[#0F1419]'
                          }`}
                        >
                          {session.courseCode}: {session.courseTitle}
                        </h4>
                        <p className="text-xs text-[#71767B] mt-0.5 leading-snug">
                          Live attendance is open. Stay within the course rep's location radius and
                          enter the verification code shared by the rep.
                        </p>
                      </div>

                      {/* Embedded Geofence Specs Card */}
                      <div
                        className={`mt-3 p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                          isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[#71767B] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#1D9BF0]" /> Venue
                          </span>
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                            {session.locationName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#71767B]">Allowed Radius</span>
                          <span className="text-[#1D9BF0] font-bold">
                            {session.radiusMeters} meters
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#71767B]">Window Closes In</span>
                          <span className="text-[#FFD400] font-bold">{remainingMinutes} mins</span>
                        </div>

                      </div>

                      {/* Attendee Progress Bar & Avatar Stack */}
                      <div className="mt-3 flex items-center justify-between text-xs text-[#71767B] font-mono">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#1D9BF0]" />
                          <span>
                            {attendeeCount} / {session.maxStudents} Students Checked In
                          </span>
                        </div>
                        <span className="text-[11px]">Get the verification code from your course rep</span>
                      </div>

                      {/* Primary Interaction Button & X Actions Bar */}
                      <div className="mt-3 pt-2 border-t border-[#2F3336]/30 flex items-center justify-between">
                        {/* Left Action Icons (Like X Post Action Bar) */}
                        <div className="flex items-center gap-4 text-[#71767B]">
                          <button
                            onClick={() => handleShareSession(session)}
                            className="flex items-center gap-1 hover:text-[#1D9BF0] transition-colors cursor-pointer text-xs"
                            title="Share Geofence Link"
                          >
                            {copiedSessionId === session.id ? (
                              <Check className="w-4 h-4 text-[#00BA7C]" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => toggleBookmark(session.id)}
                            className="flex items-center gap-1 hover:text-[#1D9BF0] transition-colors cursor-pointer text-xs"
                            title="Bookmark Lecture"
                          >
                            {isBookmarked ? (
                              <BookmarkCheck className="w-4 h-4 text-[#1D9BF0]" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Primary Check In or View Receipt Pill */}
                        {hasCheckedIn ? (
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 rounded-full bg-[#00BA7C]/15 text-[#00BA7C] border border-[#00BA7C]/30 text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verified Present</span>
                            </div>

                            {onViewSlip && checkedInRecord && (
                              <button
                                onClick={() => {
                                  soundManager.playClick();
                                  onViewSlip(checkedInRecord);
                                }}
                                className="px-3 py-1.5 rounded-full border border-[#2F3336] hover:bg-[#16181C] text-xs font-mono font-bold text-[#1D9BF0] transition-colors cursor-pointer"
                              >
                                Slip →
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              soundManager.playClick();
                              onSelectSession(session);
                            }}
                            className="py-2.5 px-5 bg-[#EFF3F4] hover:bg-white text-[#0F1419] font-black text-xs rounded-full shadow-sm transition-all active:scale-98 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Compass className="w-3.5 h-3.5 text-[#1D9BF0]" />
                            <span>Verify GPS & Check In</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: COURSES LIST */}
      {activeTab === 'courses' && (
        <div className="p-4 space-y-3">
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#71767B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search course code or title"
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none border ${
                isDark
                  ? 'bg-[#16181C] border-[#2F3336] text-white'
                  : 'bg-[#F7F9F9] border-[#EFF3F4] text-black'
              }`}
            />
          </div>

          <div className="space-y-2">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-black text-[#1D9BF0] block">
                      {course.code} · {course.level}
                    </span>
                    <h4
                      className={`text-sm font-black mt-0.5 ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    >
                      {course.title}
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-[#71767B]">
                    {course.enrolledStudentCount} Enrolled
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#2F3336]/40 flex items-center justify-between text-xs text-[#71767B]">
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-[#1D9BF0]" />
                    {course.classroom}
                  </span>
                  <span className="font-mono">{course.scheduleDay}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: SCHEDULE / TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-[#71767B] uppercase">
              Today's Lectures
            </span>
            <span className="text-xs font-mono text-[#1D9BF0]">University of Uyo</span>
          </div>

          <div className="space-y-2">
            {timetable.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#16181C] border-[#2F3336]' : 'bg-[#F7F9F9] border-[#EFF3F4]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-[#1D9BF0]">
                    {item.courseCode}
                  </span>
                  <span className="text-xs font-mono text-[#71767B]">{item.time}</span>
                </div>
                <h4
                  className={`text-sm font-bold mt-1 ${
                    isDark ? 'text-white' : 'text-black'
                  }`}
                >
                  {item.courseTitle}
                </h4>
                <div className="mt-2 flex items-center justify-between text-xs text-[#71767B]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1D9BF0]" />
                    {item.room}
                  </span>
                  <span className="font-mono font-bold text-[#00BA7C]">Scheduled</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const XHomeFeed = HomeFeed;
