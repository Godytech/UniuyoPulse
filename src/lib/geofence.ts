import { AttendanceSession, GeofenceVerification } from '../types';

// Mean Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

/**
 * Computes the great-circle distance between two points on a sphere
 * using the Haversine formula (accurate to sub-meter precision).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10; // Round to 1 decimal place
}

/**
 * Server-authoritative geofence verification logic.
 * Never trusts client boolean flags; computes distance, validates accuracy,
 * and checks time-box constraints directly.
 */
export function verifyGeofence(
  userLat: number,
  userLon: number,
  userAccuracy: number,
  session: AttendanceSession,
  now: Date = new Date()
): GeofenceVerification {
  const sessionEnd = new Date(session.endTime);
  const sessionStart = new Date(session.startTime);

  // 1. Session Status Check
  if (session.status === 'closed' || now > sessionEnd) {
    return {
      isWithinGeofence: false,
      distanceMeters: 0,
      radiusMeters: session.radiusMeters,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable: true,
      isLate: false,
      statusState: 'closed',
      message: 'Attendance Session is Closed',
      details: 'This attendance session has ended or been closed by the Course Rep / Admin.'
    };
  }

  if (now < sessionStart) {
    return {
      isWithinGeofence: false,
      distanceMeters: 0,
      radiusMeters: session.radiusMeters,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable: true,
      isLate: false,
      statusState: 'expired',
      message: 'Attendance Session Not Started',
      details: `Session opens at ${sessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    };
  }

  // 2. Location Accuracy Check (Threshold: 50 meters)
  const MAX_PERMISSIBLE_ACCURACY_METERS = 50;
  if (userAccuracy > MAX_PERMISSIBLE_ACCURACY_METERS) {
    return {
      isWithinGeofence: false,
      distanceMeters: 0,
      radiusMeters: session.radiusMeters,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable: false,
      isLate: false,
      statusState: 'poor_accuracy',
      message: 'Low GPS Accuracy',
      details: `Your GPS signal accuracy is ±${Math.round(userAccuracy)}m (threshold is ±${MAX_PERMISSIBLE_ACCURACY_METERS}m). Please move outdoors or near a window to acquire high accuracy.`
    };
  }

  // 3. Compute Distance
  const distance = calculateHaversineDistance(
    userLat,
    userLon,
    session.latitude,
    session.longitude
  );

  const isInside = distance <= session.radiusMeters;

  // 4. Late Check (if inside late threshold or within final N minutes)
  const remainingMs = sessionEnd.getTime() - now.getTime();
  const lateWindowMs = session.lateThresholdMinutes * 60 * 1000;
  const isLate = remainingMs <= lateWindowMs;

  if (!isInside) {
    const overage = Math.round(distance - session.radiusMeters);
    return {
      isWithinGeofence: false,
      distanceMeters: distance,
      radiusMeters: session.radiusMeters,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable: true,
      isLate,
      statusState: 'outside',
      message: `Outside Geofence by ${overage}m`,
      details: `You are ${Math.round(distance)}m from ${session.locationName}. Maximum allowed radius is ${session.radiusMeters}m.`
    };
  }

  if (isLate) {
    return {
      isWithinGeofence: true,
      distanceMeters: distance,
      radiusMeters: session.radiusMeters,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable: true,
      isLate: true,
      statusState: 'late',
      message: 'Inside Geofence (Late Window)',
      details: `You are ${Math.round(distance)}m away (inside ${session.radiusMeters}m radius), but checking in during the late threshold.`
    };
  }

  return {
    isWithinGeofence: true,
    distanceMeters: distance,
    radiusMeters: session.radiusMeters,
    accuracyMeters: userAccuracy,
    isAccuracyAcceptable: true,
    isLate: false,
    statusState: 'inside',
    message: 'Inside Geofence · Location Verified',
    details: `You are ${Math.round(distance)}m from the center of ${session.locationName}. Allowed: ${session.radiusMeters}m.`
  };
}

/**
 * Generates an anti-tamper device signature for the student audit trail
 */
export function generateDeviceFingerprint(): string {
  // Lightweight synchronous fingerprint suitable for quick checks during render.
  // Avoids expensive Intl/timezone operations that can block the main thread.
  try {
    const nav = window.navigator;
    const screen = window.screen;
    // Keep the sync string small: userAgent + screen + language
    const str = `${nav.userAgent}-${screen.width}x${screen.height}-${nav.language}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `FP-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  } catch (e) {
    return `FP-UNKNOWN`;
  }
}

/**
 * Computes a fuller device fingerprint off the critical path.
 * Call this from useEffect or during idle time to avoid blocking initial render.
 */
export function generateDeviceFingerprintDeferred(): Promise<string> {
  return new Promise((resolve) => {
    const compute = () => {
      try {
        const nav = window.navigator;
        const screen = window.screen;
        let tz = 'UTC';
        try {
          const ro = Intl.DateTimeFormat().resolvedOptions();
          tz = ro && (ro.timeZone || tz);
        } catch (err) {
          // Intl can be slow or throw in some environments - fall back to UTC
          tz = 'UTC';
        }

        const str = `${nav.userAgent}-${screen.width}x${screen.height}-${nav.language}-${tz}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        resolve(`FP-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`);
      } catch (e) {
        resolve(generateDeviceFingerprint());
      }
    };

    if ('requestIdleCallback' in window) {
      // Use requestIdleCallback when available to schedule off the critical path
      // @ts-ignore - lib typings may not include requestIdleCallback
      (window as any).requestIdleCallback(() => compute(), { timeout: 500 });
    } else {
      // Fallback: schedule via setTimeout to push work after paint
      setTimeout(compute, 0);
    }
  });
}

