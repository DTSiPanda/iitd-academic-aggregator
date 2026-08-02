'use client';

import { useState } from 'react';
import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import { getUrgencyLevel, formatTimeUntil, getSemesterWeekInfo } from '@/lib/fetchData';
import { COURSE_COLORS } from '@/lib/scheduleData';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
  overrides: Overrides;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarTab({ data, labGroup, overrides }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);

  const weekInfo = getSemesterWeekInfo(
    data.semester_timeline?.start_date || '2026-08-01',
    data.semester_timeline?.total_weeks || 16
  );

  const milestones = data.semester_timeline?.milestones || [
    { name: 'Semester Begins', date: '2026-08-01', type: 'info' },
    { name: 'Minor 1 Exams', date: '2026-09-18', type: 'exam' },
    { name: 'Mid-Semester Break', date: '2026-10-12', type: 'break' },
    { name: 'Minor 2 Exams', date: '2026-10-24', type: 'exam' },
    { name: 'Major / Endsem Exams', date: '2026-11-20', type: 'exam' },
  ];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map Moodle deadlines + Bot overrides + Exams to dates
  const eventsByDate: Record<string, { title: string; courseId: string; type: 'assignment' | 'exam' | 'bot'; url: string; due_date: string }[]> = {};

  // 1. Moodle assignments
  data.courses.forEach(c => {
    c.assignments.forEach(a => {
      if (!a.due_date) return;
      const d = new Date(a.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push({ title: a.title, courseId: c.id, type: 'assignment', url: a.url, due_date: a.due_date });
    });
  });

  // 2. Bot deadline overrides
  overrides.deadline_overrides.forEach(d => {
    const dateObj = new Date(d.due_date);
    const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push({ title: d.item, courseId: d.course, type: 'bot', url: '#', due_date: d.due_date });
  });

  // 3. Bot exam entries
  overrides.exams.forEach(ex => {
    const dateObj = new Date(ex.start_date);
    const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    const courseCode = (ex.courses && ex.courses[0]) || 'EXAM';
    eventsByDate[key].push({ title: `📝 EXAM: ${ex.name}`, courseId: courseCode, type: 'exam', url: '#', due_date: ex.start_date });
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getKey = (d: number) => `${year}-${month}-${d}`;
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  const isSelected = (d: number) => selected?.getDate() === d && selected?.getMonth() === month && selected?.getFullYear() === year;

  const selectedKey = selected ? `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}` : '';
  const selectedEvents = eventsByDate[selectedKey] || [];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Semester Progress & Week Tracker Card ── */}
      <div style={{
        background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '16px', marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 1 }}>
              SEMESTER TIMELINE
            </span>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              Week {weekInfo.currentWeek} of {weekInfo.totalWeeks}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 12 }}>
            {weekInfo.progressPercent}% Complete
          </div>
        </div>

        <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ width: `${weekInfo.progressPercent}%`, height: '100%', background: '#4f46e5', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Key Academic Milestones</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {milestones.map((m, i) => {
            const isExam = m.type === 'exam';
            const daysLeft = Math.ceil((new Date(m.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div key={i} style={{
                flex: '0 0 auto', padding: '8px 12px', borderRadius: 10,
                background: isExam ? '#fff7ed' : '#f8fafc',
                border: `1px solid ${isExam ? '#fde68a' : '#e2e8f0'}`,
                fontSize: 11
              }}>
                <div style={{ fontWeight: 800, color: isExam ? '#92400e' : '#334155' }}>{m.name}</div>
                <div style={{ color: isExam ? '#b45309' : '#64748b', fontSize: 10, marginTop: 2 }}>
                  {m.date} • {daysLeft > 0 ? `In ${daysLeft}d` : 'Passed'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Month Calendar Card ── */}
      <div style={{
        background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '16px', marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 800 }}>‹ Prev</button>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 800 }}>Next ›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          {DAYS_SHORT.map(d => <div key={d}>{d}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ height: 44 }} />;
            const key = getKey(d);
            const evs = eventsByDate[key] || [];
            const isT = isToday(d);
            const isS = isSelected(d);
            const hasExam = evs.some(e => e.type === 'exam');

            return (
              <button
                key={i}
                onClick={() => setSelected(new Date(year, month, d))}
                style={{
                  height: 44, borderRadius: 8,
                  border: isS ? '2px solid #4f46e5' : isT ? '2px solid #38bdf8' : hasExam ? '2px solid #f59e0b' : '1px solid #f1f5f9',
                  background: isS ? '#4f46e5' : isT ? '#f0f9ff' : hasExam ? '#fff7ed' : '#fff',
                  color: isS ? '#fff' : isT ? '#0284c7' : hasExam ? '#78350f' : '#0f172a',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative'
                }}
              >
                <span style={{ fontSize: 12, fontWeight: isS || isT || hasExam ? 900 : 600 }}>{d}</span>
                {evs.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {evs.slice(0, 3).map((e, ei) => {
                      const color = COURSE_COLORS[e.courseId] || (e.type === 'exam' ? '#f59e0b' : '#ef4444');
                      return (
                        <span key={ei} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: isS ? '#fff' : color
                        }} />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events Detail with Clear Course Code Badges */}
      {selected && (
        <div style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '16px' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
            📅 {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>No deadlines or exams on this date 🎉</div>
          ) : (
            selectedEvents.map((ev, i) => {
              const color = COURSE_COLORS[ev.courseId] || (ev.type === 'exam' ? '#d97706' : '#6366f1');
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: '#f8fafc', borderRadius: 10, marginBottom: 8,
                  borderLeft: `4px solid ${color}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Course Code Badge */}
                    <span style={{
                      fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
                      background: color + '15', color: color, textTransform: 'uppercase', flexShrink: 0
                    }}>
                      {ev.courseId}
                    </span>

                    {/* Title */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: ev.type === 'exam' ? '#92400e' : '#0f172a' }}>
                      {ev.title}
                    </span>
                  </div>

                  <span style={{ fontSize: 11, color: ev.type === 'exam' ? '#b45309' : '#ef4444', fontWeight: 900, flexShrink: 0 }}>
                    {formatTimeUntil(ev.due_date)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
