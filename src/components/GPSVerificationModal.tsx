import React, { useCallback, useState, useEffect } from 'react';
import {
  X,
  MapPin,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Lock,
  RefreshCw,
  Compass,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { AttendanceSession, User, AttendanceRecord } from '../types';
import { calculateHaversineDistance, generateDeviceFingerprint } from '../lib/geofence';
import { soundManager } from '../lib/sound';

interface GPSVerificationModalProps {
  session: AttendanceSession;
  student: User;
  onClose: () => void;
  onSubmitRecord: (record: AttendanceRecord) => void;
  onViewSlip?: (record: AttendanceRecord) => void;
  existingRecord?: AttendanceRecord;
}

export const GPSVerificationModal: React.FC<GPSVerificationModalProps> = ({
  session,
  student,
  onClose,
  onSubmitRecord,
  onViewSlip,
  existingRecord
}) => {
  // Verification lifecycle: 'scanning' | 'ready' | 'submitting' | 'success'
  const [stage, setStage] = useState<'scanning' | 'ready' | 'submitting' | 'success'>(
    existingRecord ? 'success' : 'scanning'
  );

  // GPS Telemetry values
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [createdRecord, setCreatedRecord] = useState<AttendanceRecord | null>(existingRecord || null);

  const allowedRadius = session.radiusMeters;
  const isWithinGeofence =
    distanceMeters !== null &&
    distanceMeters <= allowedRadius &&
    gpsAccuracy !== null &&
    gpsAccuracy <= 50;
  const isVerificationCodeValid = verificationCode.trim() === session.accessCode;

  const requestDeviceLocation = useCallback(() => {
    setStage('scanning');
    setPermissionError(null);
    soundManager.playRadarSweep();

    if (!navigator.geolocation) {
      setPermissionError('Geolocation is not supported by your browser.');
      setStage('ready');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const realLat = pos.coords.latitude;
        const realLng = pos.coords.longitude;
        const realAccuracy = Math.round(pos.coords.accuracy);
        const computedDistance = calculateHaversineDistance(
          realLat,
          realLng,
          session.latitude,
          session.longitude
        );

        setUserCoords({ lat: realLat, lng: realLng });
        setGpsAccuracy(realAccuracy);
        setDistanceMeters(computedDistance);
        setPermissionError(null);
        setStage('ready');
        if (computedDistance <= allowedRadius) {
          soundManager.playSuccessChime();
        } else {
          soundManager.playErrorBuzz();
        }
      },
      (err) => {
        setPermissionError(
          err.code === 1
            ? 'Location permission was denied. Please allow location access in your browser settings to verify your classroom attendance.'
            : 'Unable to retrieve your current location. Check that location services are enabled and try again.'
        );
        setStage('ready');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [allowedRadius, session.latitude, session.longitude]);

  useEffect(() => {
    if (!existingRecord) requestDeviceLocation();
  }, [existingRecord, requestDeviceLocation]);

  const handleSubmitAttendance = () => {
    if (
      !isWithinGeofence ||
      !isVerificationCodeValid ||
      !userCoords ||
      gpsAccuracy === null ||
      distanceMeters === null
    ) return;

    setStage('submitting');
    soundManager.playGpsLock();

    const newRecord: AttendanceRecord = {
      id: `rec_${Date.now()}`,
      sessionId: session.id,
      courseId: session.courseId,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      semesterId: session.semesterId,
      semesterName: session.semesterName,
      studentId: student.id,
      studentName: student.fullName,
      studentRegNo: student.studentId || 'N/A',
      status: 'present',
      latitude: userCoords.lat,
      longitude: userCoords.lng,
      locationAccuracyMeters: gpsAccuracy,
      distanceFromClassMeters: distanceMeters,
      submittedAt: new Date().toISOString(),
      deviceFingerprint: generateDeviceFingerprint(),
      verifiedByServer: false,
      verificationMethod: 'gps_code'
    };

    setCreatedRecord(newRecord);
    onSubmitRecord(newRecord);
    setStage('success');
    soundManager.playVerificationSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Location Verification</h3>
              <p className="text-[11px] text-slate-500 font-medium">GPS Geofenced Attendance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {stage === 'success' && (
            /* SECTION 9: ATTENDANCE SUCCESS SCREEN */
            <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-18 h-18 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-50 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Present
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Attendance Marked Successfully
                </h2>
                <p className="text-sm font-bold text-indigo-600 mt-1">
                  {session.courseCode} — {session.courseTitle}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{session.locationName}</p>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Student</span>
                  <span className="font-bold text-slate-900">{student.fullName} ({student.studentId || 'N/A'})</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Submitted</span>
                  <span className="font-mono font-bold text-slate-900">
                    {createdRecord ? new Date(createdRecord.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '10:08 AM'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Distance from course rep</span>
                  <span className="font-bold text-emerald-600">
                    {createdRecord ? `${Math.round(createdRecord.distanceFromClassMeters)} meters` : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Security Verification</span>
                  <span className="font-bold text-indigo-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> GPS &amp; Course Rep Code Verified
                  </span>
                </div>
              </div>

              {/* Success Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {createdRecord && onViewSlip && (
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      onViewSlip(createdRecord);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Official Slip</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onClose();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

          {stage !== 'success' && (
            <>
              {/* Visual Radar / Circular Geofence Visualizer */}
              <div className="relative py-4 flex flex-col items-center justify-center">
                {/* Geofence Circles */}
                <div className="relative w-56 h-56 rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center bg-indigo-50/30">
                  {/* Outer Allowed Radius Ring */}
                  <div
                    className={`absolute inset-4 rounded-full border-2 transition-colors ${
                      isWithinGeofence
                        ? 'border-emerald-400 bg-emerald-50/20'
                        : 'border-rose-400 bg-rose-50/20'
                    }`}
                  />

                  {/* Pulsing Sonar Effect */}
                  {stage === 'scanning' && (
                    <div className="absolute inset-8 rounded-full border border-indigo-500 animate-radar-sonar pointer-events-none" />
                  )}

                  {/* Course rep's detected location */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg ring-4 ring-indigo-100">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-700 mt-1 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                      Course Rep
                    </span>
                  </div>

                  {/* Student Dynamic Location Marker */}
                  {userCoords && <div
                    className={`absolute transition-all duration-700 flex flex-col items-center ${
                      isWithinGeofence
                        ? 'top-10 right-14'
                        : 'top-2 -right-6'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md ring-4 ${
                        isWithinGeofence
                          ? 'bg-emerald-500 ring-emerald-100 animate-bounce'
                          : 'bg-rose-500 ring-rose-100'
                      }`}
                    >
                      <Navigation className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap mt-0.5">
                      You ({distanceMeters === null ? '—' : `${Math.round(distanceMeters)}m`})
                    </span>
                  </div>}
                </div>

                {/* Radar Status Text */}
                <div className="mt-4 text-center">
                  {stage === 'scanning' ? (
                    <p className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking your location...</span>
                    </p>
                  ) : !userCoords ? (
                    <p className="text-xs font-extrabold text-amber-600 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Location unavailable</span>
                    </p>
                  ) : gpsAccuracy !== null && gpsAccuracy > 50 ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold">
                          GPS accuracy must be within ±50m. Move outdoors or near a window, then refresh your location.
                        </p>
                        <button type="button" onClick={requestDeviceLocation} className="font-bold underline">
                          Refresh location
                        </button>
                      </div>
                    </div>
                  ) : isWithinGeofence ? (
                    <p className="text-xs font-extrabold text-emerald-600 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>You are within range</span>
                    </p>
                  ) : (
                    <p className="text-xs font-extrabold text-rose-600 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>You're outside the attendance area</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 3 Telemetry Metric Boxes per Section 8 Spec */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Distance from rep</span>
                  <span className={`text-xl font-black tabular-nums mt-0.5 block ${
                    isWithinGeofence ? 'text-slate-900' : gpsAccuracy !== null && gpsAccuracy > 50 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {distanceMeters === null ? '—' : `${Math.round(distanceMeters)}m`}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Allowed radius</span>
                  <span className="text-xl font-black text-slate-900 tabular-nums mt-0.5 block">
                    {allowedRadius}m
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">GPS Accuracy</span>
                  <span className="text-xl font-black text-slate-900 tabular-nums mt-0.5 block">
                    {gpsAccuracy === null ? '—' : `±${gpsAccuracy}m`}
                  </span>
                </div>
              </div>

              {/* Feedback Alert Box */}
              {permissionError ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Location Permission Needed</p>
                    <p className="text-amber-700">{permissionError}</p>
                    <button
                      type="button"
                      onClick={requestDeviceLocation}
                      className="font-bold text-amber-900 underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : !userCoords ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-slate-500 shrink-0" />
                  <p className="font-semibold">Waiting for your device location.</p>
                </div>
              ) : gpsAccuracy !== null && gpsAccuracy > 50 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      GPS accuracy must be within ±50m. Move outdoors or near a window, then refresh your location.
                    </p>
                    <button type="button" onClick={requestDeviceLocation} className="font-bold underline">
                      Refresh location
                    </button>
                  </div>
                </div>
              ) : isWithinGeofence ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="font-semibold">
                    You're within {allowedRadius}m of the course rep's detected location.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <p className="font-semibold">
                    Move closer to the course rep and try again. You must be within {allowedRadius}m of the rep's detected location.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="attendance-verification-code" className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Course Rep Verification Code
                </label>
                <input
                  id="attendance-verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter the 6-digit code from your course rep"
                  aria-describedby="attendance-code-help"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold tracking-[0.25em] text-slate-900 placeholder:tracking-normal placeholder:font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p id="attendance-code-help" className="text-[11px] text-slate-500">
                Ask the course rep for the code in person. No fingerprint reader or biometric sign-in is required.
                </p>
                {verificationCode.length === 6 && !isVerificationCodeValid && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    That code does not match. Confirm it with the course rep.
                  </p>
                )}
              </div>

              {/* Submit Attendance Button */}
              <div className="pt-2">
                <button
                  disabled={!isWithinGeofence || !isVerificationCodeValid || stage === 'scanning' || stage === 'submitting'}
                  onClick={handleSubmitAttendance}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    isWithinGeofence && isVerificationCodeValid && stage !== 'scanning'
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white shadow-emerald-600/30'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  {stage === 'submitting' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recording & Signing Attendance...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Submit Attendance</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400 mt-2">
                  Attendance requires an in-range GPS fix and the course rep's verification code.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
