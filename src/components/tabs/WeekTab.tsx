'use client';

import { useState } from 'react';
import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import { isClassCancelled, getUrgencyLevel, formatTimeUntil, getCourseNotes, formatDueDateWithDay } from '@/lib/fetchData';
import { DAYS, LECTURE_SLOTS, LAB_SLOTS_BY_GROUP, COURSE_COLORS, TIME_ORDER, Slot } from '@/lib/scheduleData';
import ExamBanner from '@/components/ui/ExamBanner';
import NoteChip from '@/components/ui/NoteChip';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
  overrides: Overrides;
}

export default function WeekTab({ data, labGroup, overrides }: Props) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [selectedDay, setSelectedDay] = useState<string>(
    DAYS.includes(today) ? today : 'Monday'
  );

  const myLabs = LAB_SLOTS_BY_GROUP[labGroup] || [];

  function getSlotsForDay(day: string): (Slot & { cancelled: boolean })[] {
    const lectures = LECTURE_SLOTS
      .filter(s => s.days?.includes(day))
      .map(s => ({ ...s, cancelled: isClassCancelled(overrides.cancellations, s.code, day) }));

    const labs = myLabs
      .filter(s => s.days?.includes(day))
      .map(s => ({ ...s, cancelled: isClassCancelled(overrides.cancellations, s.code, day) }));

    return [...lectures, ...labs].sort((a, b) => (TIME_ORDER[a.time] ?? 0) - (TIME_ORDER[b.time] ?? 0));
  }

  const weekEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const allDeadlines = [
    ...data.courses.flatMap(c =>
      c.assignments
        .filter(a => a.due_date && a.due_date <= weekEnd)
        .map(a => ({ title: a.title, due_date: a.due_date, course: c.id, url: a.url, source: 'moodle' as const }))
    ),
    ...overrides.deadline_overrides
      .filter(d => d.due_date <= weekEnd)
      .map(d => {
        let resolvedDate = d.due_date;
        if (d.scope === 'groupwise' && d.group_deadlines && d.group_deadlines[labGroup]) {
          resolvedDate = d.group_deadlines[labGroup];
        }
        return { title: d.item, due_date: resolvedDate, course: d.course, url: '#', source: 'bot' as const };
      }),
  ].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const nextExam = overrides.exams
    .filter(e => new Date(e.end_date) >= new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];

  const slots = getSlotsForDay(selectedDay);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Exam Banner ── */}
      <ExamBanner exams={overrides.exams} />

      {/* ── Day Selector ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto',
        paddingBottom: 4, scrollbarWidth: 'none'
      }}>
        {DAYS.map(day => {
          const isToday = day === today;
          const isActive = day === selectedDay;
          const daySlots = getSlotsForDay(day);
          const hasCancellation = daySlots.some(s => s.cancelled);
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                flex: '0 0 auto',
                padding: '8px 14px',
                borderRadius: 10,
                border: isActive ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                background: isActive ? '#4f46e5' : isToday ? '#f0f0ff' : '#fff',
                color: isActive ? '#fff' : isToday ? '#4f46e5' : '#64748b',
                fontWeight: isActive || isToday ? 800 : 600,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {day.slice(0, 3)}
              {isToday && <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#4f46e5', border: '2px solid #fff' }} />}
              {hasCancellation && <span style={{ position: 'absolute', top: -4, left: -4, fontSize: 10 }}>⚠️</span>}
            </button>
          );
        })}
      </div>

      {/* ── Day Header ── */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>
          {selectedDay}
          {selectedDay === today && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: 20 }}>TODAY</span>
          )}
        </h2>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          {slots.length === 0 ? 'No classes — free day 🎉' : `${slots.length} class${slots.length > 1 ? 'es' : ''}`}
        </div>
      </div>

      {/* ── Slot Cards ── */}
      {slots.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 16px',
          background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0'
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, color: '#64748b' }}>Free day! No classes scheduled.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slots.map((slot, i) => {
            const color = COURSE_COLORS[slot.code] ?? '#64748b';
            const notes = getCourseNotes(overrides.notes, slot.code);
            return (
              <div
                key={i}
                style={{
                  background: slot.cancelled ? '#fef2f2' : '#fff',
                  border: `2px solid ${slot.cancelled ? '#fca5a5' : slot.type === 'lab' ? '#fde68a' : color + '40'}`,
                  borderLeft: `4px solid ${slot.cancelled ? '#ef4444' : color}`,
                  borderRadius: 12, padding: '12px 16px',
                  opacity: slot.cancelled ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 900, color,
                        textDecoration: slot.cancelled ? 'line-through' : 'none'
                      }}>
                        {slot.cancelled ? '❌ ' : ''}{slot.code}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                        background: slot.type === 'lab' ? '#fef3c7' : color + '15',
                        color: slot.type === 'lab' ? '#92400e' : color,
                        textTransform: 'uppercase'
                      }}>
                        {slot.type === 'lab' ? '🔬 Lab' : '📖 Lec'}
                      </span>
                      {slot.cancelled && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: 6 }}>CANCELLED</span>
                      )}
                    </div>

                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#0f172a',
                      textDecoration: slot.cancelled ? 'line-through' : 'none'
                    }}>
                      {slot.course}
                    </div>

                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      📍 {slot.venue}
                    </div>

                    {slot.note && (
                      <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 3 }}>
                        ℹ️ {slot.note}
                      </div>
                    )}

                    {notes.slice(0, 2).map((note, ni) => (
                      <NoteChip key={ni} note={note} />
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{slot.time}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Deadlines This Week ── */}
      {allDeadlines.length > 0 && (
        <div style={{
          marginTop: 24, background: '#fff', border: '2px solid #e2e8f0',
          borderRadius: 14, overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>📅 Due This Week</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{allDeadlines.length} items</span>
          </div>
          {allDeadlines.map((d, i) => {
            const urgency = getUrgencyLevel(d.due_date);
            const color = COURSE_COLORS[d.course] ?? '#64748b';
            const URGENCY_COLORS: Record<string, string> = { overdue: '#ef4444', critical: '#f97316', warning: '#f59e0b', safe: '#10b981' };
            return (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderBottom: i < allDeadlines.length - 1 ? '1px solid #f8fafc' : 'none',
                textDecoration: 'none', background: '#fff', transition: 'background 0.1s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: URGENCY_COLORS[urgency], flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.title}</span>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '15', padding: '1px 6px', borderRadius: 4 }}>{d.course}</span>
                      {d.source === 'bot' && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '1px 6px', borderRadius: 4 }}>BOT</span>}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: URGENCY_COLORS[urgency],
                  background: URGENCY_COLORS[urgency] + '15', padding: '4px 8px', borderRadius: 6, flexShrink: 0
                }}>
                  {formatDueDateWithDay(d.due_date)} ({formatTimeUntil(d.due_date)})
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* ── Group Info Footer ── */}
      <div style={{
        marginTop: 20, padding: '10px 16px',
        background: '#f8fafc', borderRadius: 10,
        fontSize: 11, color: '#94a3b8', textAlign: 'center'
      }}>
        Showing schedule for <strong style={{ color: '#4f46e5' }}>Group {labGroup.replace('group', '')}</strong> •
        Labs shown on days they occur for your group
      </div>
    </div>
  );
}
