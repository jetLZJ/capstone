import { describe, it, expect } from 'vitest';
import { startOfWeek, addDays, parseISOToDate, timeOverlap } from '../scheduleHelpers';

describe('ScheduleCalendar helpers', () => {
  it('startOfWeek returns Sunday midnight', () => {
    const dt = new Date('2025-09-30T12:34:00Z');
    const s = startOfWeek(dt);
    expect(s.getDay()).toBe(0);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
  });

  it('addDays adds days', () => {
    const d = new Date('2025-09-30');
    const nx = addDays(d, 3);
    const diffMs = nx.setHours(0,0,0,0) - d.setHours(0,0,0,0);
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(3);
  });

  it('parseISOToDate returns a Date for valid iso and NaN date for invalid', () => {
    const good = parseISOToDate('2025-09-30T08:00:00Z');
    expect(good instanceof Date).toBe(true);
    const bad = parseISOToDate('not-a-date');
    expect(isNaN(bad.getTime())).toBe(true);
  });

  it('timeOverlap detects overlapping intervals', () => {
    const a1 = new Date('2025-09-30T08:00:00Z');
    const a2 = new Date('2025-09-30T10:00:00Z');
    const b1 = new Date('2025-09-30T09:00:00Z');
    const b2 = new Date('2025-09-30T11:00:00Z');
    expect(timeOverlap(a1,a2,b1,b2)).toBe(true);
    const c1 = new Date('2025-09-30T10:00:00Z');
    const c2 = new Date('2025-09-30T11:00:00Z');
    expect(timeOverlap(a1,a2,c1,c2)).toBe(false);
  });
});
