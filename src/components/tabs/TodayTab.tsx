'use client';

import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import {
  formatTimeUntil, getUrgencyLevel, getResourceUrl,
  getSemesterWeekInfo, isClassCancelled, getCourseNotes
} from '@/lib/fetchData';
import { DAYS, LECTURE_SLOTS, LAB_SLOTS_BY_GROUP, COURSE_COLORS, TIME_ORDER, Slot } from '@/lib/scheduleData';
import ExamBanner from '@/components/ui/ExamBanner';
import NoteChip from '@/components/ui/NoteChip';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
  overrides: Overrides;
}

export default function TodayTab({ data, labGroup, overrides }: Props) {
  const now = new Date();
  const todayName = DAYS[now.getDay() - 1] || (now.getDay() === 0 ? 'Sunday' : 'Monday');
  const tomorrowIdx = (now.getDay() % 7);
  const tomorrowName = DAYS[tomorrowIdx === 0 ? 6 : tomorrowIdx - 1] || 'Monday';

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const weekInfo = getSemesterWeekInfo(data.semester_timeline?.start_date || '2026-08-01', data.semester_timeline?.total_weeks || 16);

  const myLabs = LAB_SLOTS_BY_GROUP[labGroup] || [];

  // Helper to fetch slots for a given day
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

  // Deadlines filtering
  const weekEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();

  const allDeadlines = [
    ...data.courses.flatMap(c =>
      c.assignments
        .filter(a => a.due_date && a.due_date <= weekEnd)
        .map(a => ({ title: a.title, due_date: a.due_date!, course: c.id, url: a.url, source: 'moodle' as const }))
    ),
    ...overrides.deadline_overrides
      .filter(d => d.due_date <= weekEnd)
      .map(d => ({ title: d.item, due_date: d.due_date, course: d.course, url: '#', source: 'bot' as const })),
  ].sort((a, b) => a.due_date.localeCompare(b.due_date));

  const todayDeadlines = allDeadlines.filter(d => d.due_date <= todayEnd);
  const tomorrowDeadlines = allDeadlines.filter(d => d.due_date > todayEnd && d.due_date <= tomorrowEnd);
  const thisWeekDeadlines = allDeadlines.filter(d => d.due_date > tomorrowEnd && d.due_date <= weekEnd);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Semester Week Awareness Header ── */}
      <div style={{
        background: '#0f172a', color: '#fff', borderRadius: 14, padding: '16px', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
            IIT DELHI • SEMESTER 1 (2026-27)
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>
            Week {weekInfo.currentWeek} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/ {weekInfo.totalWeeks}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8' }}>{todayName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Group {labGroup.replace('group', '')}</div>
        </div>
      </div>

      {/* ── Exam Banner ── */}
      <ExamBanner exams={overrides.exams} />

      {/* ── 1. TODAY'S ACTION PLAN ── */}
      <div style={{
        background: '#fff', border: '2px solid #3b82f6', borderRadius: 16, padding: '16px', marginBottom: 20,
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📌</span>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>TODAY'S ACTION PLAN</h2>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 12 }}>
            {todayName.toUpperCase()}
          </span>
        </div>

        {/* Today's Classes */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Classes & Labs Today</div>
          {todaySlots.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>No classes today 🎉</div>
          ) : (
            todaySlots.map((slot, i) => {
              const color = COURSE_COLORS[slot.code] ?? '#64748b';
              const notes = getCourseNotes(overrides.notes, slot.code);
              return (
                <div key={i} style={{
                  background: slot.cancelled ? '#fef2f2' : '#f8fafc',
                  borderLeft: `4px solid ${slot.cancelled ? '#ef4444' : color}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color, textDecoration: slot.cancelled ? 'line-through' : 'none' }}>
                        {slot.cancelled ? '❌ ' : ''}{slot.code} — {slot.course}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: slot.type === 'lab' ? '#fef3c7' : '#e0e7ff', color: slot.type === 'lab' ? '#92400e' : '#3730a3' }}>
                        {slot.type === 'lab' ? 'Lab' : 'Lec'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📍 {slot.venue}</div>
                    {notes.slice(0, 1).map((n, ni) => <NoteChip key={ni} note={n} />)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{slot.time}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Today's Deadlines */}
        {todayDeadlines.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase' }}>⚠️ Due Today</div>
            {todayDeadlines.map((d, i) => {
              const color = COURSE_COLORS[d.course] || '#ef4444';
              return (
                <div key={i} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: color, color: '#fff' }}>{d.course}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#991b1b' }}>{d.title}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#ef4444' }}>{formatTimeUntil(d.due_date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. TOMORROW'S ACTION PLAN ── */}
      <div style={{
        background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '16px', marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔜</span>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#334155', margin: 0 }}>TOMORROW'S ACTION PLAN</h2>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 12 }}>
            {tomorrowName.toUpperCase()}
          </span>
        </div>

        {/* Tomorrow's Classes */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Tomorrow's Schedule</div>
          {tomorrowSlots.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>No classes tomorrow 🎉</div>
          ) : (
            tomorrowSlots.map((slot, i) => {
              const color = COURSE_COLORS[slot.code] ?? '#64748b';
              return (
                <div key={i} style={{
                  background: '#f8fafc', borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{slot.code} — {slot.course}</span>
                    <div style={{ fontSize: 11, color: '#64748b' }}>📍 {slot.venue}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{slot.time}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Tomorrow's Deadlines */}
        {tomorrowDeadlines.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', marginBottom: 6, textTransform: 'uppercase' }}>⚠️ Due Tomorrow</div>
            {tomorrowDeadlines.map((d, i) => {
              const color = COURSE_COLORS[d.course] || '#f59e0b';
              return (
                <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: color, color: '#fff' }}>{d.course}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{d.title}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b' }}>{formatTimeUntil(d.due_date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. THIS WEEK'S ACTION PLAN ── */}
      <div style={{
        background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '16px', marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🗓</span>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#334155', margin: 0 }}>THIS WEEK'S DEADLINES & GOALS</h2>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>{thisWeekDeadlines.length} items</span>
        </div>

        {thisWeekDeadlines.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>No more deadlines this week 🎉</div>
        ) : (
          thisWeekDeadlines.map((d, i) => {
            const urgency = getUrgencyLevel(d.due_date);
            const color = COURSE_COLORS[d.course] ?? '#64748b';
            return (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderBottom: i < thisWeekDeadlines.length - 1 ? '1px solid #f1f5f9' : 'none',
                textDecoration: 'none'
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.title}</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '15', padding: '1px 6px', borderRadius: 4 }}>{d.course}</span>
                    {d.source === 'bot' && <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', padding: '1px 6px', borderRadius: 4 }}>BOT</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: urgency === 'critical' ? '#ef4444' : '#f59e0b' }}>
                  {formatTimeUntil(d.due_date)}
                </span>
              </a>
            );
          })
        )}
      </div>

    </div>
  );
}
