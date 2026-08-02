export interface Resource {
  type: 'file' | 'url';
  title: string;
  url: string;
  uploaded_at: string;
  is_new: boolean;
  category?: 'lab' | 'tutorial' | 'lecture' | 'notice';
  group_deadlines?: Record<string, string>;
}

export interface Assignment {
  title: string;
  url: string;
  due_date: string | null;
  due_date_raw: string | null;
  is_new: boolean;
}

export interface Course {
  id: string;
  name: string;
  moodle: 'old' | 'new';
  color: string;
  url: string;
  instructor?: string;
  credits?: number;
  type?: string;
  venue?: string;
  new_items: Resource[];
  assignments: Assignment[];
}

export interface LectureSlot {
  course: string;
  time: string;
  venue: string;
  type?: string;
  note?: string;
}

export interface LabSlot {
  course: string;
  day: string;
  time: string;
  venue: string;
  note?: string;
}

export interface LabSchedules {
  group1: LabSlot[];
  group2: LabSlot[];
  group3: LabSlot[];
  group4: LabSlot[];
}

export interface Milestone {
  name: string;
  date: string;
  type: 'info' | 'exam' | 'break';
}

export interface SemesterTimeline {
  start_date: string;
  end_date: string;
  total_weeks: number;
  milestones: Milestone[];
}

export interface AggregatorData {
  last_updated: string;
  courses: Course[];
  lab_schedules: LabSchedules;
  lecture_schedule: Record<string, LectureSlot[]>;
  semester_timeline?: SemesterTimeline;
}

// ── Bot-written overrides (from bot/overrides.json) ──────────────────────────

export interface Cancellation {
  course: string;
  day: string;
  date?: string;
  note?: string;
  added_at: string;
}

export interface DeadlineOverride {
  course: string;
  item: string;
  due_date: string;
  scope?: 'groupwise' | 'wholeclass';
  group?: string;
  note?: string;
  added_at: string;
}

export interface ExamEntry {
  name: string;
  start_date: string;
  end_date: string;
  courses?: string[];
  note?: string;
  added_at: string;
}

export interface NoteEntry {
  course: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  added_at: string;
}

export interface FlaggedResource {
  course: string;
  title: string;
  reason: string;
  added_at: string;
}

export interface LabDoneEntry {
  course: string;
  experiment: string;
  done_date: string;
  report_due: string;
}

export interface Overrides {
  cancellations: Cancellation[];
  deadline_overrides: DeadlineOverride[];
  exams: ExamEntry[];
  notes: NoteEntry[];
  flagged: FlaggedResource[];
  lab_done: LabDoneEntry[];
}

export type LabGroup = 'group1' | 'group2' | 'group3' | 'group4';
