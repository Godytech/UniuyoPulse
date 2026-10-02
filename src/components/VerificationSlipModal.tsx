import React from 'react';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { AttendanceRecord } from '../types';
import { soundManager } from '../lib/sound';
import { printSheet } from '../lib/printSheet';

interface VerificationSlipModalProps {
  record: AttendanceRecord;
  onClose: () => void;
}

export const VerificationSlipModal: React.FC<VerificationSlipModalProps> = ({
  record,
  onClose
}) => {
  const handlePrint = () => {
    soundManager.playClick();
    printSheet('printing-verification-slip');
  };

  const recordReference = record.id;

  return (
    <div className="verification-slip-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="verification-slip-modal bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-slate-900">Attendance Record Slip</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Print Slip"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Slip Container */}
        <div className="verification-slip-scroll p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 print:p-0">
          <div className="verification-slip-print border-2 border-slate-200 rounded-3xl p-6 sm:p-7 space-y-6 relative bg-gradient-to-b from-white to-slate-50/50">
            {/* Watermark badge */}
            <div className="absolute right-6 top-6 opacity-10 pointer-events-none">
              <ShieldCheck className="w-32 h-32 text-indigo-900" />
            </div>

            {/* University Letterhead Header */}
            <div className="text-center border-b border-slate-200 pb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-900 text-white font-black text-xl mb-2 shadow-sm">
                U
              </div>
              <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                University of Uyo
              </h2>
              <p className="text-xs font-bold text-slate-700">Faculty of Science • Department of Computer Science</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Uniuyo Pulse Biometric & GPS Geofence Verification System
              </p>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ATTENDANCE RECORD</span>
              </div>
            </div>

            {/* Student & Course Details */}
            <div className="verification-slip-details grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block uppercase text-[10px]">Student Name</span>
                <span className="font-extrabold text-slate-900 text-sm">{record.studentName}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block uppercase text-[10px]">Registration Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{record.studentRegNo}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block uppercase text-[10px]">Course Code & Title</span>
                <span className="font-bold text-slate-900">{record.courseCode} — {record.courseTitle}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block uppercase text-[10px]">Attendance Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                  {record.status}
                </span>
              </div>
            </div>

            {/* Geofence & Hardware Telemetry Audit Grid */}
            <div className="bg-slate-100/80 rounded-2xl p-4 space-y-3 text-xs border border-slate-200/80">
              <div className="verification-slip-audit-heading flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Geofence Audit Trail</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {record.verificationMethod === 'session_host'
                    ? 'SESSION HOST · NOT GPS VERIFIED'
                    : record.verificationMethod === 'gps_code'
                      ? 'GPS + REP CODE CHECK'
                      : record.verifiedByServer ? 'SERVER VERIFIED' : 'CLIENT LOCATION CHECK'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Submitted Timestamp:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {new Date(record.submittedAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Distance From Course Rep:</span>
                  <span className="font-bold text-slate-800">
                    {record.verificationMethod === 'session_host'
                      ? 'Not GPS verified'
                      : `${record.distanceFromClassMeters} meters`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">GPS Accuracy Fix:</span>
                  <span className="font-mono text-slate-800">
                    {record.verificationMethod === 'session_host'
                      ? 'Not recorded'
                      : `±${record.locationAccuracyMeters} meters`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Device ID (non-biometric):</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {record.verificationMethod === 'session_host'
                      ? 'Session host · auto-added'
                      : record.deviceFingerprint || 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verification QR / Signature Section */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Record Reference</span>
                <p className="font-mono text-[11px] font-bold text-slate-800">{recordReference}</p>
                <p className="text-[10px] text-slate-400">Reference generated from the attendance record ID</p>
              </div>

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Verification Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
