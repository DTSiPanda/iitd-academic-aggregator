'use client';

import { SemesterTimeline } from '@/types/schema';

interface Props {
  timeline?: SemesterTimeline;
}

export default function SemesterTimelineHeader({ timeline }: Props) {
  if (!timeline || !timeline.start_date || !timeline.end_date) return null;

  const now = new Date();
  const start = new Date('2026-07-23'); // Lock to official IITD start date

  // Calculate Monday-anchored current week
  const startDay = start.getDay();
  const daysToMonday = startDay === 0 ? -6 : 1 - startDay;
  const weekAnchor = new Date(start);
  weekAnchor.setDate(start.getDate() + daysToMonday);
  weekAnchor.setHours(0, 0, 0, 0);

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, nowMidnight.getTime() - weekAnchor.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(17, Math.floor(diffDays / 7) + 1);

  // Find next milestone / exam
  const milestones = timeline.milestones || [
    { name: 'Mid-Semester Exams (Minor)', date: '2026-09-12', type: 'exam' },
    { name: 'End-Semester Exams (Major)', date: '2026-11-19', type: 'exam' },
  ];

  const nextMilestone = milestones
    .map(m => ({ ...m, msDate: new Date(m.date) }))
    .filter(m => m.msDate.getTime() >= nowMidnight.getTime())
    .sort((a, b) => a.msDate.getTime() - b.msDate.getTime())[0];

  const daysToMilestone = nextMilestone
    ? Math.ceil((nextMilestone.msDate.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{
      background: '#0f172a', color: '#fff', padding: '8px 16px',
      fontSize: 12, borderBottom: '1px solid #1e293b'
    }}>
      <div style={{
        maxWidth: 1300, margin: '0 auto', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
      }}>
        {/* Left: Current Week Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 900, background: '#38bdf8', color: '#0f172a',
            padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.5
          }}>
            🗓 WEEK {currentWeek} OF 17
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Sem 1 (2026-27)</span>
        </div>

        {/* Right: Milestone / Quiz / Exam Countdown Ticker */}
        {nextMilestone && daysToMilestone !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              📝 {nextMilestone.name}:
            </span>
            <span style={{
              fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 6,
              background: daysToMilestone <= 7 ? '#ef4444' : daysToMilestone <= 21 ? '#f59e0b' : '#10b981',
              color: '#fff'
            }}>
              {daysToMilestone === 0 ? 'TODAY' : `In ${daysToMilestone}d (${nextMilestone.date})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
