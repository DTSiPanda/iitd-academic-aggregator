import { Course, Assignment } from '@/types/schema';
import { getUrgencyLevel, formatTimeUntil } from '@/lib/fetchData';

interface Props {
  courses: Course[];
  activeCourses: Set<string>;
}

const URGENCY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning:  '🟡',
  safe:     '🟢',
  overdue:  '⚫',
};

interface FlatAssignment extends Assignment {
  courseId: string;
  courseName: string;
  courseColor: string;
}

export default function UpcomingDeadlines({ courses, activeCourses }: Props) {
  const all: FlatAssignment[] = courses
    .filter(c => activeCourses.has(c.id))
    .flatMap(c => c.assignments.map(a => ({
      ...a,
      courseId: c.id,
      courseName: c.name,
      courseColor: c.color,
    })))
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  const upcoming = all.filter(a => getUrgencyLevel(a.due_date) !== 'overdue');
  const overdue  = all.filter(a => getUrgencyLevel(a.due_date) === 'overdue');

  const renderItem = (a: FlatAssignment, i: number) => {
    const urgency = getUrgencyLevel(a.due_date);
    return (
      <a
        key={i}
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="assignment-item"
      >
        <div className={`urgency-ring ${urgency}`}>
          {URGENCY_EMOJI[urgency]}
        </div>
        <div className="assignment-info">
          <div className={`assignment-title ${urgency === 'overdue' ? 'overdue' : ''}`}>
            {a.title}
          </div>
          <div className="assignment-course" style={{ color: a.courseColor }}>
            {a.courseId}
          </div>
        </div>
        <div className="assignment-due">
          <span className={`due-countdown ${urgency}`}>
            {formatTimeUntil(a.due_date)}
          </span>
          {a.due_date_raw && (
            <span className="due-date-raw">{a.due_date_raw}</span>
          )}
        </div>
      </a>
    );
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon" style={{ background: 'rgba(255,77,109,0.15)', color: '#ff4d6d' }}>📅</span>
          Due Soon
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {overdue.length > 0 && (
            <span className="section-count" style={{ background: 'rgba(255,77,109,0.2)', color: '#ff4d6d' }}>
              {overdue.length} overdue
            </span>
          )}
          <span className="section-count">{all.length} total</span>
        </div>
      </div>
      <div className="section-body">
        {all.length === 0 ? (
          <div className="section-empty">
            <div style={{ fontSize: 32 }}>✅</div>
            <p>No assignments posted yet. Enjoy it while it lasts.</p>
          </div>
        ) : (
          <>
            {overdue.map(renderItem)}
            {upcoming.map(renderItem)}
          </>
        )}
      </div>
    </div>
  );
}
