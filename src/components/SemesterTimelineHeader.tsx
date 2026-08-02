'use client';

import { SemesterTimeline, Overrides } from '@/types/schema';
import { COURSE_COLORS } from '@/lib/scheduleData';

interface Props {
  timeline?: SemesterTimeline;
  overrides?: Overrides;
}

export default function SemesterTimelineHeader({ timeline, overrides }: Props) {
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

  // Extract upcoming Quizzes, Tests & Exams logged via Telegram bot / overrides
  const upcomingQuizzesAndExams: { title: string; course: string; date: string; type: 'quiz' | 'exam' }[] = [];

  if (overrides) {
    // 1. Quizzes and lab deadline overrides
    overrides.deadline_overrides.forEach(d => {
      if (new Date(d.due_date).getTime() >= nowMidnight.getTime()) {
        upcomingQuizzesAndExams.push({
          title: d.item,
          course: d.course,
          date: d.due_date,
          type: 'quiz'
        });
      }
    });

    // 2. Custom exams logged via bot
    overrides.exams.forEach(e => {
      if (new Date(e.end_date).getTime() >= nowMidnight.getTime()) {
        upcomingQuizzesAndExams.push({
          title: e.name,
          course: e.courses?.[0] || 'IITD',
          date: e.start_date,
          type: 'exam'
        });
      }
    });
  }

  // Sort upcoming by earliest date
  upcomingQuizzesAndExams.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextQuiz = upcomingQuizzesAndExams[0] || null;
  const daysLeft = nextQuiz
    ? Math.ceil((new Date(nextQuiz.date).getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24))
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

        {/* Right: Upcoming Quiz / Bot Logged Event Ticker */}
        {nextQuiz && daysLeft !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
              📝 NEXT QUIZ/TEST:
            </span>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4,
              background: COURSE_COLORS[nextQuiz.course] || '#6366f1', color: '#fff'
            }}>
              {nextQuiz.course}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              {nextQuiz.title}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 6,
              background: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#10b981',
              color: '#fff'
            }}>
              {daysLeft === 0 ? 'TODAY' : `In ${daysLeft}d`}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡ Log quizzes & tests via Telegram Bot</span>
          </div>
        )}
      </div>
    </div>
  );
}
