'use client';

import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import { getSemesterWeekInfo, isClassCancelled, formatDueDateWithDay, formatTimeUntil } from '@/lib/fetchData';
import { LECTURE_SLOTS, LAB_SLOTS_BY_GROUP, COURSE_COLORS, TIME_ORDER, Slot } from '@/lib/scheduleData';
import ExamBanner from '@/components/ui/ExamBanner';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
  overrides: Overrides;
}

export default function TodayTab({ data, labGroup, overrides }: Props) {
  const now = new Date();
  const currentHour = now.getHours();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = DAY_NAMES[now.getDay()];
  const tomorrowName = DAY_NAMES[(now.getDay() + 1) % 7];

  const weekInfo = getSemesterWeekInfo('2026-07-23', 17);
  const myLabs = LAB_SLOTS_BY_GROUP[labGroup] || [];

  function getDaySlots(day: string): (Slot & { cancelled: boolean })[] {
    const lectures = LECTURE_SLOTS
      .filter(s => s.days?.includes(day))
      .map(s => ({ ...s, cancelled: isClassCancelled(overrides.cancellations, s.code, day) }));

    const labs = myLabs
      .filter(s => s.days?.includes(day))
      .map(s => ({ ...s, cancelled: isClassCancelled(overrides.cancellations, s.code, day) }));

    return [...lectures, ...labs].sort((a, b) => (TIME_ORDER[a.time] ?? 0) - (TIME_ORDER[b.time] ?? 0));
  }

  const todaySlots = getDaySlots(todayName);
  const tomorrowSlots = getDaySlots(tomorrowName);

  // Time visibility rules
  const showTodaySchedule = currentHour < 20;     // Until 8:00 PM
  const showTomorrowSchedule = currentHour >= 12; // From 12:00 PM noon onwards

  // Deadlines filtering (resolving groupwise dates for user's labGroup)
  const weekEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();

  const resolvedOverrides = overrides.deadline_overrides.map(d => {
    let resolvedDueDate = d.due_date;
    if (d.scope === 'groupwise' && d.group_deadlines && d.group_deadlines[labGroup]) {
      resolvedDueDate = d.group_deadlines[labGroup];
    }
    return { ...d, due_date: resolvedDueDate };
  });

  const allDeadlines = [
    ...data.courses.flatMap(c =>
      c.assignments
        .filter(a => a.due_date && a.due_date <= weekEnd)
        .map(a => ({ title: a.title, due_date: a.due_date!, course: c.id, url: a.url, source: 'moodle' as const, scope: 'wholeclass' }))
    ),
    ...resolvedOverrides
      .filter(d => d.due_date <= weekEnd)
      .map(d => ({ title: d.item, due_date: d.due_date, course: d.course, url: '#', source: 'bot' as const, scope: d.scope || 'groupwise' })),
  ].sort((a, b) => a.due_date.localeCompare(b.due_date));

  const todayDeadlines = allDeadlines.filter(d => d.due_date <= todayEnd);
  const tomorrowDeadlines = allDeadlines.filter(d => d.due_date > todayEnd && d.due_date <= tomorrowEnd);
  const upcomingDeadlines = allDeadlines.filter(d => d.due_date > tomorrowEnd);

  // Next upcoming quiz
  const nextQuiz = resolvedOverrides[0] || null;
  const daysLeftQuiz = nextQuiz
    ? Math.ceil((new Date(nextQuiz.due_date).getTime() - now.getTime()) / 86400000)
    : null;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Top Overview Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 16, padding: '16px 20px', color: '#fff',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            SEMESTER PROGRESS
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span>Week {weekInfo.currentWeek}</span>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>/ 17 Weeks</span>
          </div>
        </div>

        {nextQuiz && daysLeftQuiz !== null ? (
          <div style={{ background: '#ffffff15', border: '1px solid #ffffff25', padding: '8px 12px', borderRadius: 10, textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#f8fafc', textTransform: 'uppercase' }}>NEXT QUIZ / TEST</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', marginTop: 1 }}>{nextQuiz.course} — {nextQuiz.item}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{formatDueDateWithDay(nextQuiz.due_date)}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            📍 {todayName} • Group {labGroup.replace('group', '')}
          </div>
        )}
      </div>

      <ExamBanner exams={overrides.exams} />

      {/* ── 1. TODAY'S ACTION PLAN (Shown until 8:00 PM) ── */}
      {showTodaySchedule && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📌</span>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: 0 }}>TODAY'S SCHEDULE ({todayName.toUpperCase()})</h2>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 12 }}>
              {todaySlots.length} Classes Today
            </span>
          </div>

          {/* Classes Today */}
          <div style={{ marginBottom: 12 }}>
            {todaySlots.length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>No classes today 🎉</div>
            ) : (
              todaySlots.map((slot, i) => {
                const color = COURSE_COLORS[slot.code] ?? '#64748b';
                return (
                  <div key={i} style={{
                    background: slot.cancelled ? '#fef2f2' : '#f8fafc',
                    borderLeft: `4px solid ${slot.cancelled ? '#ef4444' : color}`,
                    borderRadius: 10, padding: '10px 14px', marginBottom: 6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: slot.cancelled ? '#ef4444' : color, textDecoration: slot.cancelled ? 'line-through' : 'none' }}>
                        {slot.cancelled ? '❌ ' : ''}{slot.code} — {slot.course}
                      </span>
                      <div style={{ fontSize: 11, color: '#64748b' }}>📍 {slot.venue}</div>
                      {slot.note && (
                        <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 2 }}>ℹ️ {slot.note}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{slot.time}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Due Today */}
          {todayDeadlines.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fee2e2' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase' }}>🚨 Due Today</div>
              {todayDeadlines.map((d, i) => (
                <div key={i} style={{ background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#9f1239' }}>{d.course} — {d.title}</span>
                    <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>{formatDueDateWithDay(d.due_date)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: 6 }}>TODAY</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. TOMORROW'S OUTLOOK (Shown from 12:00 PM Noon onwards) ── */}
      {showTomorrowSchedule && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔜</span>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: 0 }}>TOMORROW'S SCHEDULE ({tomorrowName.toUpperCase()})</h2>
            </div>
          </div>

          {tomorrowSlots.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>No classes tomorrow 🎉</div>
          ) : (
            tomorrowSlots.map((slot, i) => {
              const color = COURSE_COLORS[slot.code] ?? '#64748b';
              return (
                <div key={i} style={{
                  background: slot.cancelled ? '#fef2f2' : '#f8fafc',
                  borderLeft: `4px solid ${slot.cancelled ? '#ef4444' : color}`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: slot.cancelled ? '#ef4444' : color, textDecoration: slot.cancelled ? 'line-through' : 'none' }}>
                      {slot.cancelled ? '❌ ' : ''}{slot.code} — {slot.course}
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b' }}>📍 {slot.venue}</div>
                    {slot.note && (
                      <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 2 }}>ℹ️ {slot.note}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{slot.time}</span>
                </div>
              );
            })
          )}

          {/* Due Tomorrow */}
          {tomorrowDeadlines.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fef3c7' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#b45309', marginBottom: 6, textTransform: 'uppercase' }}>⚠️ Due Tomorrow</div>
              {tomorrowDeadlines.map((d, i) => (
                <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#78350f' }}>{d.course} — {d.title}</span>
                    <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginTop: 2 }}>{formatDueDateWithDay(d.due_date)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: 6 }}>TOMORROW</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3. UPCOMING DEADLINES THIS WEEK ── */}
      {upcomingDeadlines.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#4f46e5', marginBottom: 10, textTransform: 'uppercase' }}>
            📅 Upcoming This Week
          </div>
          {upcomingDeadlines.map((d, i) => (
            <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{d.course} — {d.title}</span>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 2 }}>{formatDueDateWithDay(d.due_date)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '4px 8px', borderRadius: 6 }}>
                {formatTimeUntil(d.due_date)}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
