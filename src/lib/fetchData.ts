import { AggregatorData, Overrides } from '@/types/schema';
import { supabase } from '@/lib/supabaseClient';

const EMPTY_OVERRIDES: Overrides = {
  cancellations: [],
  deadline_overrides: [],
  exams: [],
  notes: [],
  flagged: [],
  lab_done: [],
};

export async function fetchData(): Promise<AggregatorData> {
  try {
    const { data } = await supabase.from('moodle_data').select('data').eq('id', 'current_data').single();
    if (data && data.data && Object.keys(data.data).length > 0) {
      return data.data as AggregatorData;
    }
  } catch {
    // fallback to static file
  }
  const res = await fetch('/data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch data.json');
  return res.json();
}

export interface SemesterWeekInfo {
  currentWeek: number;
  totalWeeks: number;
  progressPercent: number;
  startDate: string;
  endDate: string;
}

export function getSemesterWeekInfo(startDateStr = '2026-07-23', totalWeeks = 17): SemesterWeekInfo {
  const start = new Date(startDateStr);
  const now = new Date();

  // Anchor to the Monday of the semester start week
  // getDay(): 0=Sun, 1=Mon ... 6=Sat
  const startDay = start.getDay(); // e.g. Thu = 4
  const daysToMonday = startDay === 0 ? -6 : 1 - startDay; // go back to Monday
  const weekAnchor = new Date(start);
  weekAnchor.setDate(start.getDate() + daysToMonday); // Monday of the week containing start date
  weekAnchor.setHours(0, 0, 0, 0);

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, nowMidnight.getTime() - weekAnchor.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(totalWeeks, Math.floor(diffDays / 7) + 1);
  const progressPercent = Math.min(100, Math.round((currentWeek / totalWeeks) * 100));
  const end = new Date(weekAnchor.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000);

  return {
    currentWeek,
    totalWeeks,
    progressPercent,
    startDate: startDateStr,
    endDate: end.toISOString().split('T')[0],
  };
}

export async function fetchOverrides(): Promise<Overrides> {
  try {
    // 1. Try Supabase DB
    const { data } = await supabase.from('overrides').select('data').eq('id', 'user_overrides').single();
    if (data && data.data) {
      return data.data as Overrides;
    }
  } catch {
    // fallback
  }

  try {
    const res = await fetch(`/overrides.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
    return EMPTY_OVERRIDES;
  } catch {
    return EMPTY_OVERRIDES;
  }
}

// Merge helper: is a class cancelled today?
export function isClassCancelled(
  cancellations: Overrides['cancellations'],
  course: string,
  day: string
): boolean {
  if (!cancellations || cancellations.length === 0) return false;
  const courseClean = course.trim().toLowerCase();
  const dayClean = day.trim().toLowerCase();

  return cancellations.some(c => {
    const cCourse = (c.course || '').trim().toLowerCase();
    const cDay = (c.day || '').trim().toLowerCase();

    const matchCourse = cCourse === courseClean || cCourse.includes(courseClean) || courseClean.includes(cCourse);
    const matchDay = cDay === dayClean;
    return matchCourse && matchDay;
  });
}

// Get all notes for a course sorted by priority
export function getCourseNotes(notes: Overrides['notes'], courseId: string) {
  const priority = { high: 0, medium: 1, low: 2 };
  return notes
    .filter(n => n.course === courseId)
    .sort((a, b) => priority[a.priority] - priority[b.priority]);
}

// Get next upcoming exam from overrides
export function getNextExam(exams: Overrides['exams']) {
  const now = new Date();
  return exams
    .filter(e => new Date(e.end_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0] ?? null;
}


export function getResourceUrl(courseId: string, res: { title: string; url: string; type?: string }): string {
  if (!res.url) return '#';
  return res.url;
}

export function getUrgencyLevel(dueDateISO: string | null): 'overdue' | 'critical' | 'warning' | 'safe' {
  if (!dueDateISO) return 'safe';
  const now = new Date();
  const due = new Date(dueDateISO);
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 0) return 'overdue';
  if (diffHours < 24) return 'critical';
  if (diffHours < 72) return 'warning';
  return 'safe';
}

export function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export function formatTimeUntil(isoString: string | null): string {
  if (!isoString) return 'No due date';
  const now = new Date();
  const due = new Date(isoString);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs < 0) {
    const overdueMins = Math.floor(-diffMs / 60000);
    const overdueHours = Math.floor(overdueMins / 60);
    const overdueDays = Math.floor(overdueHours / 24);
    if (overdueDays > 0) return `${overdueDays}d overdue`;
    if (overdueHours > 0) return `${overdueHours}h overdue`;
    return `${overdueMins}m overdue`;
  }

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return `${mins}m left`;
}

export function formatDueDateWithDay(isoString: string | null): string {
  if (!isoString) return 'No due date';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  return `${dayName}, ${monthDay} • ${timeStr}`;
}

export function formatSyncAge(lastUpdatedISO: string): { text: string; status: 'fresh' | 'stale' | 'old' } {
  const now = new Date();
  const updated = new Date(lastUpdatedISO);
  const diffMins = Math.floor((now.getTime() - updated.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);

  let text: string;
  if (diffMins < 1) text = 'just synced';
  else if (diffMins < 60) text = `${diffMins}m ago`;
  else text = `${diffHours}h ${diffMins % 60}m ago`;

  let status: 'fresh' | 'stale' | 'old';
  if (diffMins < 180) status = 'fresh';       // < 3h
  else if (diffMins < 360) status = 'stale';  // < 6h
  else status = 'old';                         // > 6h

  return { text, status };
}

export function getTodaysDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

export function getCourseName(courseId: string, courses: { id: string; name: string }[]): string {
  return courses.find(c => c.id === courseId)?.name ?? courseId;
}
