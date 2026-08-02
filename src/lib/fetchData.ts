import { AggregatorData, Overrides } from '@/types/schema';

const EMPTY_OVERRIDES: Overrides = {
  cancellations: [],
  deadline_overrides: [],
  exams: [],
  notes: [],
  flagged: [],
  lab_done: [],
};

// In production, these are served from /public/ by Next.js
export async function fetchData(): Promise<AggregatorData> {
  const res = await fetch('/data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch data.json');
  return res.json();
}

export async function fetchOverrides(): Promise<Overrides> {
  try {
    // 1. Try local / public overrides with cache busting
    const res = await fetch(`/overrides.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return await res.json();

    // 2. Fallback to GitHub Raw Content (always fresh from Bot commits)
    const rawRes = await fetch(`https://raw.githubusercontent.com/DTSiPanda/iitd-academic-aggregator/main/public/overrides.json?t=${Date.now()}`);
    if (rawRes.ok) return await rawRes.json();

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
  return cancellations.some(c => c.course === course && c.day === day);
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

  if (days > 0) return `in ${days}d ${hours % 24}h`;
  if (hours > 0) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
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
