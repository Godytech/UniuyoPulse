import React, { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Radio,
  Sliders,
  ShieldCheck,
  Compass,
  Navigation,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Course } from '../types';
import { soundManager } from '../lib/sound';
import type { NewAttendanceSession } from '../lib/firebase';

function getAcademicTerm(semesterName?: string): { semester: string; academicSession: string } | null {
  const match = semesterName?.match(/^(First|Second) Semester\s+(\d{4}\/\d{4})$/i);
  if (!match) return null;
  return {
    semester: `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} Semester`,
    academicSession: match[2]
  };
}

interface CreateSessionModalProps {
  courses: Course[];
  onClose: () => void;
  onCreateSession: (session: NewAttendanceSession) => Promise<void>;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  courses,
  onClose,
  onCreateSession
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [academicSession, setAcademicSession] = useState(
    () => getAcademicTerm(courses[0]?.semesterName)?.academicSession ?? ''
  );
  const [semester, setSemester] = useState(
    () => getAcademicTerm(courses[0]?.semesterName)?.semester ?? ''
  );
  const [customLocationName, setCustomLocationName] = useState('');
  const [deviceLocation, setDeviceLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const handleUseDeviceLocation = () => {
    soundManager.playRadarSweep();
    setFormError(null);
    if (!navigator.geolocation) {
      setFormError('Location detection is not supported by this browser. Try a modern browser on a secure connection (HTTPS).');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        if (!customLocationName.trim()) setCustomLocationName('Classroom');
        if (pos.coords.accuracy > 50) {
          setFormError(`GPS accuracy is ±${Math.round(pos.coords.accuracy)}m. Move outdoors or near a window and detect your location again; accuracy must be within ±50m.`);
        }
        setIsLocating(false);
        soundManager.playSuccessChime();
      },
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Enable location access for this site in your browser settings, then try again.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your device could not determine its location. Turn on device location and try again.'
            : 'Location detection timed out. Move to an area with a better GPS signal and try again.';
        setFormError(reason);
        setIsLocating(false);
        soundManager.playErrorBuzz();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) {
      setFormError('Create or assign a course before opening an attendance session.');
      return;
    }
    if (!customLocationName.trim()) {
      setFormError('Enter the classroom or venue name.');
      return;
    }
    if (!deviceLocation) {
      setFormError('Turn on location access and detect the classroom location before creating the session.');
      return;
    }
    if (deviceLocation.accuracy > 50) {
      setFormError('GPS accuracy must be within ±50m before you can create the attendance session.');
      return;
    }
    const courseTerm = getAcademicTerm(selectedCourse.semesterName);
    const semesterName = courseTerm
      ? `${courseTerm.semester} ${courseTerm.academicSession}`
      : semester && academicSession.trim()
        ? `${semester} ${academicSession.trim()}`
        : '';
    const termMatch = semesterName.match(/^(First|Second) Semester\s+(\d{4})\/(\d{4})$/);
    if (!termMatch || Number(termMatch[3]) !== Number(termMatch[2]) + 1) {
      setFormError('Choose a course with a valid semester, or enter the term in First/Second Semester YYYY/YYYY format.');
      return;
    }
    setFormError(null);
    soundManager.playGpsLock();

    setIsCreating(true);
    try {
      await onCreateSession({
        courseId: selectedCourse.id,
        semesterName,
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        locationAccuracyMeters: deviceLocation.accuracy,
        radiusMeters,
        locationName: customLocationName.trim(),
        durationMinutes,
        lateThresholdMinutes: graceMinutes
      });
      soundManager.playVerificationSuccess();
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the attendance session.');
      soundManager.playErrorBuzz();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Create Attendance Session</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                University of Uyo • GPS Geofenced Class Broadcast
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form (Sections 15 & 16) */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Academic Term & Course Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  const nextCourse = courses.find((course) => course.id === e.target.value);
                  const term = getAcademicTerm(nextCourse?.semesterName);
                  setSelectedCourseId(e.target.value);
                  setAcademicSession(term?.academicSession ?? '');
                  setSemester(term?.semester ?? '');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {!selectedCourse && <option value="">Select a course</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="academic-session" className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Academic Session
              </label>
              <input
                id="academic-session"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="e.g. YYYY/YYYY"
                disabled={Boolean(getAcademicTerm(selectedCourse?.semesterName))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="semester" className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Semester
              </label>
              <select
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={Boolean(getAcademicTerm(selectedCourse?.semesterName))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                <option value="">Not specified</option>
                <option value="First Semester">First Semester</option>
                <option value="Second Semester">Second Semester</option>
              </select>
            </div>
          </div>

          {/* Classroom Geofence Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Classroom Geofence Location
              </label>
              <button
                type="button"
                onClick={handleUseDeviceLocation}
                disabled={isLocating}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-60 flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{isLocating ? 'Detecting location…' : deviceLocation ? 'Update detected location' : 'Enable & Detect Location'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input
                aria-label="Classroom or venue name"
                value={customLocationName}
                onChange={(e) => setCustomLocationName(e.target.value)}
                placeholder="Classroom or venue name"
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Detect your location at the class and stay there while attendance is open. Students must be within 50–100 m of this location, enable location on their phones, and enter the six-digit code you share with them in person.
              </span>
            </div>
            {deviceLocation && (
              <p className={`flex items-center gap-1.5 text-xs font-semibold ${
                deviceLocation.accuracy <= 50 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {deviceLocation.accuracy <= 50
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <AlertCircle className="h-4 w-4" />}
                Location accuracy ±{Math.round(deviceLocation.accuracy)} m (must be within ±50 m).
              </p>
            )}
            {formError && <p role="alert" className="text-xs font-semibold text-rose-600">{formError}</p>}
          </div>

          {/* Interactive Geofence Map / Radar Visualizer per Section 16 */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Course Rep Location Geofence</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                Rep location radius: {radiusMeters} meters
              </span>
            </div>

            {/* Radar Visual Circle */}
            <div className="relative h-44 rounded-xl border border-indigo-500/20 bg-indigo-950/40 flex items-center justify-center overflow-hidden">
              {/* Concentric distance rings */}
              <div className="absolute w-36 h-36 rounded-full border border-indigo-400/20" />
              <div className="absolute w-24 h-24 rounded-full border border-indigo-400/30" />
              <div
                className="absolute rounded-full border-2 border-emerald-400 bg-emerald-500/10 transition-all duration-300"
                style={{
                  width: `${Math.min(160, Math.max(70, radiusMeters * 1.5))}px`,
                  height: `${Math.min(160, Math.max(70, radiusMeters * 1.5))}px`
                }}
              />

              {/* Center Course Rep location marker */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg ring-4 ring-indigo-400/30">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-200 mt-1 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs">
                  {deviceLocation ? 'Course Rep location' : 'Detect your location'}
                </span>
              </div>
            </div>

            {/* Radius Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-indigo-200">
                <span>Geofence Boundary Radius</span>
                <span className="font-bold text-white tabular-nums">{radiusMeters} meters</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>50m</span>
                <span>75m</span>
                <span>100m</span>
              </div>
            </div>
          </div>

          {/* Time & Grace Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Session Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (Standard)</option>
                <option value={90}>90 Minutes</option>
                <option value={120}>120 Minutes (2 Hours)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Late Grace Period
              </label>
              <select
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes (Standard)</option>
                <option value={20}>20 Minutes</option>
              </select>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedCourse || !deviceLocation || deviceLocation.accuracy > 50 || isLocating || isCreating}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-extrabold text-white flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Radio className="w-4 h-4" />
            <span>{isCreating ? 'Creating session…' : 'Create Attendance Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
