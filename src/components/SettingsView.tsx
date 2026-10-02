import React, { useState } from 'react';
import {
  ShieldCheck,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  Save,
  LogOut
} from 'lucide-react';
import { soundManager } from '../lib/sound';

interface SettingsViewProps {
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onLogout
}) => {
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggleSound = () => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  };

  const handleSave = () => {
    soundManager.playClick();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Settings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage sound and device security preferences.
          </p>
        </div>
      </div>

      {/* GPS & Security Telemetry Settings */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-extrabold text-slate-900">Security & Geofence Telemetry</h3>
        </div>

        <div className="space-y-4">
          {/* Sound Synthesizer */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-indigo-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-900">Radar & Interaction Audio</p>
                <p className="text-[11px] text-slate-500">
                  Subtle Web Audio API chimes during GPS sweeps and successful attendance verification
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleSound}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          {/* Device Fingerprint Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-900">Registered Hardware Token</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Your device is registered with the University of Uyo computer science anti-tamper ledger. Proxies and spoofed GPS coordinates will fail cryptographic signing.
            </p>
          </div>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
          {onLogout ? (
            <button
              onClick={() => {
                soundManager.playClick();
                onLogout();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Account</span>
            </button>
          ) : <div />}

          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Preferences Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
