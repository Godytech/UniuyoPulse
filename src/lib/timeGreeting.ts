import { useState, useEffect } from 'react';
import { CloudSun, MoonStar, Sparkles, SunMedium, Sunset } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeGreetingInfo {
  greeting: string;
  period: TimePeriod;
  timeString: string;
  fullDateString: string;
  timeZone: string;
  timeZoneShort: string;
  hour: number;
}

let timeFormatter: Intl.DateTimeFormat | undefined;
let dateFormatter: Intl.DateTimeFormat | undefined;
let timeZoneFormatter: Intl.DateTimeFormat | undefined;

/**
 * Returns the time-of-day greeting based on the user's location/local time.
 * - 05:00 - 11:59: Good morning
 * - 12:00 - 16:59: Good afternoon
 * - 17:00 - 21:59: Good evening
 * - 22:00 - 04:59: Good evening
 */
export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

/**
 * Returns the contextual time period ('morning' | 'afternoon' | 'evening' | 'night')
 */
export function getTimePeriod(date: Date = new Date()): TimePeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Returns a familiar local-time icon matching the detected time period.
 */
export function getTimeEmoji(period: TimePeriod): LucideIcon {
  switch (period) {
    case 'morning':
      return SunMedium;
    case 'afternoon':
      return CloudSun;
    case 'evening':
      return Sunset;
    case 'night':
      return MoonStar;
    default:
      return Sparkles;
  }
}

/**
 * Computes full time greeting info for a given date
 */
export function getTimeGreetingInfo(date: Date = new Date()): TimeGreetingInfo {
  const hour = date.getHours();
  const greeting = getTimeBasedGreeting(date);
  const period = getTimePeriod(date);

  let timeString = '';
  try {
    timeFormatter ??= new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    timeString = timeFormatter.format(date);
  } catch {
    timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  let fullDateString = '';
  try {
    dateFormatter ??= new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    fullDateString = dateFormatter.format(date);
  } catch {
    fullDateString = date.toDateString();
  }

  let timeZone = '';
  let timeZoneShort = '';
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    timeZone = resolved.timeZone || 'Local';
    // Short code like WAT, EDT, UTC
    timeZoneFormatter ??= new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' });
    const parts = timeZoneFormatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    timeZoneShort = tzPart?.value || timeZone;
  } catch {
    timeZone = 'Local Time';
    timeZoneShort = '';
  }

  return {
    greeting,
    period,
    timeString,
    fullDateString,
    timeZone,
    timeZoneShort,
    hour
  };
}

/**
 * React hook that dynamically detects location time and keeps greeting up to date
 */
export function useTimeGreeting(): TimeGreetingInfo {
  const [info, setInfo] = useState<TimeGreetingInfo>(() => {
    const date = new Date();
    const hour = date.getHours();
    return {
      greeting: getTimeBasedGreeting(date),
      period: getTimePeriod(date),
      timeString: `${hour.toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      fullDateString: '',
      timeZone: 'Local Time',
      timeZoneShort: '',
      hour
    };
  });

  useEffect(() => {
    setInfo(getTimeGreetingInfo(new Date()));

    const interval = setInterval(() => {
      setInfo(getTimeGreetingInfo(new Date()));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return info;
}
