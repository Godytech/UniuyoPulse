import React from 'react';
import { motion } from 'motion/react';
import { Navigation, AlertTriangle, CheckCircle2, XCircle, Compass } from 'lucide-react';
import { GeofenceVerification } from '../types';

interface RadiusGaugeProps {
  verification: GeofenceVerification | null;
  allowedRadius: number;
  isVerifying?: boolean;
  className?: string;
}

export const RadiusGauge: React.FC<RadiusGaugeProps> = ({
  verification,
  allowedRadius,
  isVerifying = false,
  className = ''
}) => {
  const distance = verification ? verification.distanceMeters : 0;
  const accuracy = verification ? verification.accuracyMeters : 8;
  const isInside = verification ? verification.isWithinGeofence : false;
  const isLate = verification ? verification.isLate : false;
  const state = verification ? verification.statusState : 'verifying';

  // Calculate ratio for the user position indicator
  // If distance > 2 * allowedRadius, clamp visually to outer boundary edge
  const maxVisualRadius = allowedRadius * 1.6;
  const visualRatio = allowedRadius > 0 ? Math.min(distance / maxVisualRadius, 1) : 0;

  // Visual dimension constants
  const size = 280;
  const center = size / 2;
  const maxRingRadius = 110;
  const allowedRingRadius = (allowedRadius / maxVisualRadius) * maxRingRadius;
  
  // Calculate position of the user's GPS marker along the radial axis (with a slight 45 degree angle for natural compass visual)
  const angleRad = -Math.PI / 4; // top-right offset
  const userMarkerDistance = visualRatio * maxRingRadius;
  const userX = center + Math.cos(angleRad) * userMarkerDistance;
  const userY = center + Math.sin(angleRad) * userMarkerDistance;

  // Determine theme color
  let strokeColor = '#5B7FFF'; // --compass blue
  let glowColor = 'rgba(91, 127, 255, 0.2)';
  let badgeBg = 'bg-[#1E2A3D] text-[#8C9AB3] border-[#2A3648]';
  let statusIcon = <Compass className="w-4 h-4 animate-spin text-[#5B7FFF]" />;
  let headline = 'ACQUIRING GPS FIX…';

  if (isVerifying) {
    strokeColor = '#5B7FFF';
    glowColor = 'rgba(91, 127, 255, 0.3)';
    badgeBg = 'bg-[#5B7FFF]/10 text-[#5B7FFF] border-[#5B7FFF]/30';
    statusIcon = <Compass className="w-4 h-4 animate-spin text-[#5B7FFF]" />;
    headline = 'VERIFYING WITH SERVER…';
  } else if (verification) {
    if (state === 'poor_accuracy') {
      strokeColor = '#F0B429';
      glowColor = 'rgba(240, 180, 41, 0.25)';
      badgeBg = 'bg-[#F0B429]/10 text-[#F0B429] border-[#F0B429]/30';
      statusIcon = <AlertTriangle className="w-4 h-4 text-[#F0B429]" />;
      headline = 'POOR GPS ACCURACY';
    } else if (state === 'closed' || state === 'expired') {
      strokeColor = '#8C9AB3';
      glowColor = 'rgba(140, 154, 179, 0.15)';
      badgeBg = 'bg-[#1E2A3D] text-[#8C9AB3] border-[#2A3648]';
      statusIcon = <XCircle className="w-4 h-4 text-[#8C9AB3]" />;
      headline = state === 'closed' ? 'SESSION CLOSED' : 'NOT ACTIVE';
    } else if (isInside) {
      if (isLate) {
        strokeColor = '#F0B429'; // --caution amber
        glowColor = 'rgba(240, 180, 41, 0.25)';
        badgeBg = 'bg-[#F0B429]/10 text-[#F0B429] border-[#F0B429]/30';
        statusIcon = <AlertTriangle className="w-4 h-4 text-[#F0B429]" />;
        headline = 'WITHIN GEOFENCE · LATE';
      } else {
        strokeColor = '#3DDC97'; // --signal mint green
        glowColor = 'rgba(61, 220, 151, 0.25)';
        badgeBg = 'bg-[#3DDC97]/10 text-[#3DDC97] border-[#3DDC97]/30';
        statusIcon = <CheckCircle2 className="w-4 h-4 text-[#3DDC97]" />;
        headline = 'WITHIN GEOFENCE · PRESENT';
      }
    } else {
      strokeColor = '#EF5F5F'; // --alert red
      glowColor = 'rgba(239, 95, 95, 0.25)';
      badgeBg = 'bg-[#EF5F5F]/10 text-[#EF5F5F] border-[#EF5F5F]/30';
      statusIcon = <XCircle className="w-4 h-4 text-[#EF5F5F]" />;
      const overage = Math.round(distance - allowedRadius);
      headline = `OUTSIDE BY ${overage} METERS`;
    }
  }

  return (
    <div className={`flex flex-col items-center select-none w-full ${className}`}>
      {/* Concentric Circle Radar / Responsive SVG Gauge */}
      <div className="relative w-full max-w-[280px] aspect-square flex items-center justify-center">
        {/* Subtle Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full transition-colors duration-500 blur-2xl opacity-40 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />

        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full relative overflow-visible"
        >
          {/* Compass Crosshairs */}
          <line
            x1={center}
            y1={16}
            x2={center}
            y2={size - 16}
            stroke="#2A3648"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.6"
          />
          <line
            x1={16}
            y1={center}
            x2={size - 16}
            y2={center}
            stroke="#2A3648"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.6"
          />

          {/* Compass direction labels */}
          <text x={center} y={12} fill="#8C9AB3" fontSize="9" textAnchor="middle" fontWeight="bold">N</text>
          <text x={size - 8} y={center + 3} fill="#8C9AB3" fontSize="9" textAnchor="middle" fontWeight="bold">E</text>
          <text x={center} y={size - 4} fill="#8C9AB3" fontSize="9" textAnchor="middle" fontWeight="bold">S</text>
          <text x={8} y={center + 3} fill="#8C9AB3" fontSize="9" textAnchor="middle" fontWeight="bold">W</text>

          {/* Outer Visual Boundary Ring (Max boundary) */}
          <circle
            cx={center}
            cy={center}
            r={maxRingRadius}
            fill="none"
            stroke="#1E2A3D"
            strokeWidth="1"
          />

          {/* Inner 50% scale ring */}
          <circle
            cx={center}
            cy={center}
            r={allowedRingRadius * 0.5}
            fill="none"
            stroke="#2A3648"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.5"
          />

          {/* GEOFENCE PERIMETER RING (The Allowed Radius) */}
          <motion.circle
            cx={center}
            cy={center}
            r={allowedRingRadius}
            fill={isInside ? `${strokeColor}10` : 'transparent'}
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={isInside ? 'none' : '4 4'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />

          {/* Radius threshold label on perimeter */}
          <text
            x={center + allowedRingRadius - 4}
            y={center - 6}
            fill={strokeColor}
            fontSize="10"
            textAnchor="end"
            className="tabular-nums font-mono"
            opacity="0.9"
          >
            {allowedRadius}m boundary
          </text>

          {/* Classroom Center Marker */}
          <circle cx={center} cy={center} r={4} fill="#5B7FFF" />
          <circle cx={center} cy={center} r={8} fill="none" stroke="#5B7FFF" strokeWidth="1" opacity="0.5" />

          {/* User Location Radar Marker */}
          {verification && (
            <g>
              {/* Radial connecting vector line */}
              <line
                x1={center}
                y1={center}
                x2={userX}
                y2={userY}
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.7"
              />

              {/* Accuracy halo (represents GPS uncertainty ±meters) */}
              <motion.circle
                cx={userX}
                cy={userY}
                r={Math.max(6, Math.min(24, accuracy * 0.8))}
                fill={strokeColor}
                fillOpacity="0.15"
                stroke={strokeColor}
                strokeWidth="1"
                strokeOpacity="0.4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              />

              {/* User position pulse */}
              <motion.circle
                cx={userX}
                cy={userY}
                r={6}
                fill={strokeColor}
                initial={{ scale: 0.5 }}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <circle cx={userX} cy={userY} r={2} fill="#0E1520" />
            </g>
          )}
        </svg>

        {/* Center Distance Readout Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
          <div className="text-3xl font-display font-bold tracking-tight text-[#F4F6FA] tabular-nums">
            {isVerifying ? (
              <span className="text-xl text-[#5B7FFF] animate-pulse">Scanning...</span>
            ) : verification ? (
              `${Math.round(distance)}m`
            ) : (
              '-- m'
            )}
          </div>
          <span className="text-[11px] uppercase tracking-wider text-[#8C9AB3] font-medium">
            Distance to Hall
          </span>
        </div>
      </div>

      {/* Primary Status Banner Chip */}
      <div
        className={`mt-4 px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${badgeBg}`}
      >
        {statusIcon}
        <span className="tracking-wide uppercase font-mono text-[11px]">{headline}</span>
      </div>

      {/* Accuracy & Parameter Details */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[#8C9AB3] font-mono tabular-nums">
        <div className="flex items-center gap-1">
          <span className="text-[#8C9AB3]/70">Allowed:</span>
          <span className="text-[#F4F6FA] font-medium">{allowedRadius}m</span>
        </div>
        <span className="text-[#2A3648]">|</span>
        <div className="flex items-center gap-1">
          <span className="text-[#8C9AB3]/70">Accuracy:</span>
          <span className={`font-medium ${accuracy <= 50 ? 'text-[#3DDC97]' : 'text-[#EF5F5F]'}`}>
            ±{Math.round(accuracy)}m
          </span>
        </div>
      </div>

      {/* Plain Language Instruction (Errors speak in instructions, not apologies) */}
      {verification && !isInside && state === 'outside' && (
        <p className="mt-2 text-xs text-center text-[#EF5F5F] max-w-[320px] font-sans">
          Move closer to the lecture hall. You are {Math.round(distance - allowedRadius)}m outside the {allowedRadius}m attendance perimeter.
        </p>
      )}
      {verification && state === 'poor_accuracy' && (
        <p className="mt-2 text-xs text-center text-[#F0B429] max-w-[320px] font-sans">
          GPS uncertainty is too high (±{Math.round(accuracy)}m). Please step outdoors or near a window to acquire satellite lock.
        </p>
      )}
    </div>
  );
};
