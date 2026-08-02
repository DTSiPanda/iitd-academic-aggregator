'use client';

import { SemesterTimeline } from '@/types/schema';

interface Props {
  timeline?: SemesterTimeline;
}

export default function SemesterTimelineHeader({ timeline }: Props) {
  if (!timeline || !timeline.start_date || !timeline.end_date) return null;

  const now = new Date();
  const start = new Date(timeline.start_date);
  const end = new Date(timeline.end_date);

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());

  // Week calculation
  const diffDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(timeline.total_weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
  const progressPct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

  // Find next milestone
  const nextMilestone = timeline.milestones
    .map(m => ({ ...m, msDate: new Date(m.date) }))
    .filter(m => m.msDate.getTime() >= now.getTime())
    .sort((a, b) => a.msDate.getTime() - b.msDate.getTime())[0];

  const daysToMilestone = nextMilestone
    ? Math.ceil((nextMilestone.msDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{
      background: '#ffffff',
      borderBottom: '1px solid #cbd5e1',
      padding: '10px 24px',
      fontSize: 12,
      color: '#0f172a',
    }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        {/* Left: Week & Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="urgency-badge critical" style={{ fontSize: 11, padding: '4px 10px' }}>
            🗓 WEEK {currentWeek} OF {timeline.total_weeks}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Semester Progress:</span>
            <div style={{ width: 100, height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#4f46e5', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5' }}>{progressPct}%</span>
          </div>
        </div>

        {/* Right: Milestone Countdown */}
        {nextMilestone && daysToMilestone !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⏱</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{nextMilestone.name}:</span>
            <span className={`urgency-badge ${daysToMilestone < 14 ? 'critical' : 'warning'}`} style={{ fontSize: 11 }}>
              {daysToMilestone === 0 ? 'TODAY' : `In ${daysToMilestone} Days (${nextMilestone.date})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
