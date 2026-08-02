'use client';

import { useState } from 'react';
import { AggregatorData, LabGroup, LectureSlot, LabSlot, Resource, Overrides } from '@/types/schema';
import { formatTimeUntil, getUrgencyLevel, formatRelativeTime } from '@/lib/fetchData';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
  overrides: Overrides;
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function parseTimeToMinutes(timeStr: string): number {
  const start = timeStr.split('-')[0].trim();
  const isPM = timeStr.toUpperCase().includes('PM');
  const [h, m] = start.replace(/[AP]M/i, '').trim().split(':').map(Number);
  let hours = h;
  if (isPM && h !== 12) hours += 12;
  if (!isPM && h === 12) hours = 0;
  return hours * 60 + (m || 0);
}

export default function TodayTab({ data, labGroup, overrides }: Props) {
  const [showNotices, setShowNotices] = useState(false);
  const now = new Date();
  const todayName = DAYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Classify all resources
  const allResources = data.courses.flatMap(c =>
    c.new_items.map(r => ({
      ...r,
      courseId: c.id,
      courseName: c.name,
      courseColor: c.color,
      groupDeadline: r.group_deadlines ? r.group_deadlines[labGroup] : undefined,
    }))
  );

  const labResources      = allResources.filter(r => r.category === 'lab');
  const tutorialResources = allResources.filter(r => r.category === 'tutorial');
  const lectureResources  = allResources.filter(r => r.category === 'lecture');
  const noticeResources   = allResources.filter(r => r.category === 'notice');

  // Build today's events: lectures + labs
  const lectureSlots: (LectureSlot & { kind: 'lecture' })[] =
    ((data.lecture_schedule && data.lecture_schedule[todayName]) || []).map(s => ({ ...s, kind: 'lecture' as const }));

  const labSlots: (LabSlot & { kind: 'lab' })[] =
    ((data.lab_schedules && data.lab_schedules[labGroup]) || [])
      .filter(s => s.day === todayName)
      .map(s => ({ ...s, kind: 'lab' as const }));

  type Event = { kind: 'lecture' | 'lab'; course: string; time: string; venue: string; note?: string; startMin: number };
  const allEvents: Event[] = [
    ...lectureSlots.map(s => ({ ...s, startMin: parseTimeToMinutes(s.time) })),
    ...labSlots.map(s => ({ ...s, startMin: parseTimeToMinutes(s.time) })),
  ].sort((a, b) => a.startMin - b.startMin);

  const nextEvent = allEvents.find(e => e.startMin > currentMinutes);
  const currentEvent = allEvents.find(e => {
    const dur = e.kind === 'lab' ? 120 : 55;
    return e.startMin <= currentMinutes && e.startMin + dur > currentMinutes;
  });

  // Upcoming deadlines (Moodle + bot overrides merged)
  const weekEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const moodleDeadlines = data.courses.flatMap(c =>
    c.assignments
      .filter(a => a.due_date && a.due_date <= weekEnd)
      .map(a => ({ title: a.title, url: a.url, due_date: a.due_date, courseId: c.id, courseName: c.name, courseColor: c.color, source: 'moodle' as const, note: undefined as string | undefined }))
  );
  const botDeadlines = overrides.deadline_overrides
    .filter(d => d.due_date <= weekEnd)
    .map(d => ({ title: d.item, url: '#', due_date: d.due_date, courseId: d.course, courseName: d.course, courseColor: '#6366f1', source: 'bot' as const, note: d.note }));
  const weekDeadlines = [...moodleDeadlines, ...botDeadlines]
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  return (
    <div className="today-tab">
      {/* ── DO THIS NEXT: Action Priority Engine ── */}
      <div style={{ background: '#ffffff', border: '2px solid #4f46e5', borderRadius: 16, padding: 20, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              DO THIS NEXT — Priority Action Queue
            </h2>
          </div>
          <span className="legend-pill lecture" style={{ fontSize: 11 }}>
            {labGroup.toUpperCase().replace('GROUP', 'GROUP ')} ACTIVE
          </span>
        </div>

        {/* Upcoming Exam Warning (from bot overrides) */}
        {overrides.exams.filter(e => new Date(e.end_date) >= new Date()).slice(0, 1).map((exam, i) => {
          const days = Math.ceil((new Date(exam.start_date).getTime() - new Date().getTime()) / 86400000);
          return (
            <div key={i} style={{ background: '#fff7ed', border: '2px solid #f59e0b', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>📝 UPCOMING EXAM</span>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#78350f', marginTop: 2 }}>{exam.name}</div>
              <div style={{ fontSize: 11, color: '#92400e' }}>{exam.start_date} — {days > 0 ? `In ${days} days` : 'TODAY'}</div>
            </div>
          );
        })}

        {/* Immediate Next Class */}
        {currentEvent ? (
          <div className="block-lecture" style={{ marginBottom: 10, background: '#eeeffe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#e11d48' }}>🔴 LIVE CLASS NOW</span>
              <span className="legend-pill lecture">{currentEvent.time}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1e1b4b', marginTop: 2 }}>{currentEvent.course} {currentEvent.kind === 'lab' ? 'Lab' : ''}</div>
            <div style={{ fontSize: 12, color: '#4338ca', fontWeight: 600 }}>📍 Confirmed Venue: {currentEvent.venue}</div>
          </div>
        ) : nextEvent ? (
          <div className="block-lecture" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5' }}>⏱ NEXT CLASS TODAY</span>
              <span className="legend-pill lecture">Starts {nextEvent.time.split('-')[0]}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1e1b4b', marginTop: 2 }}>{nextEvent.course} {nextEvent.kind === 'lab' ? 'Lab' : ''}</div>
            <div style={{ fontSize: 11, color: '#4338ca', fontWeight: 600 }}>📍 Venue: {nextEvent.venue}</div>
          </div>
        ) : null}

        {/* Group-Aware Actionable Lab Items */}
        {labResources.slice(0, 3).map((lab, i) => (
          <a key={i} href={lab.url} target="_blank" rel="noopener noreferrer" className="block-lab" style={{ display: 'block', marginBottom: 8, textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>🧪 Lab Report / Worksheet</span>
              {lab.groupDeadline && (
                <span className="urgency-badge warning" style={{ fontSize: 10 }}>
                  Scheduled: {lab.groupDeadline}
                </span>
              )}
            </div>
            <div className="block-lab-title" style={{ marginTop: 2 }}>{lab.courseId} — {lab.title}</div>
          </a>
        ))}
      </div>

      {/* ── Categorized Workflows ── */}
      <div className="today-grid">
        {/* 🧪 Lab Reports & Worksheets Hub */}
        <div className="card-box">
          <div className="card-box-header">
            <span>🧪 Lab Reports & Worksheets</span>
            <span>{labResources.length} Items</span>
          </div>
          {labResources.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No lab sheets uploaded yet.
            </div>
          ) : (
            labResources.map((res, i) => (
              <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="item-row">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="legend-pill lab" style={{ fontSize: 9 }}>{res.courseId}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{res.title}</span>
                  </div>
                  {res.groupDeadline && (
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginTop: 3 }}>
                      📍 Lab Slot: {res.groupDeadline}
                    </div>
                  )}
                </div>
                {res.is_new && <span className="urgency-badge safe">NEW</span>}
              </a>
            ))
          )}
        </div>

        {/* 📝 Tutorial Sheets Queue */}
        <div className="card-box">
          <div className="card-box-header">
            <span>📝 Tutorial Sheets Queue</span>
            <span>{tutorialResources.length} Sheets</span>
          </div>
          {tutorialResources.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No tutorial sheets posted yet.
            </div>
          ) : (
            tutorialResources.map((res, i) => (
              <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="item-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="legend-pill lecture" style={{ fontSize: 9 }}>{res.courseId}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{res.title}</span>
                </div>
                {res.is_new && <span className="urgency-badge safe">NEW</span>}
              </a>
            ))
          )}
        </div>
      </div>

      {/* 🗓 Upcoming Deadlines (Moodle + Bot Overrides) */}
      {weekDeadlines.length > 0 && (
        <div className="card-box">
          <div className="card-box-header">
            <span>🗓 Upcoming Deadlines (Next 7 Days)</span>
            <span>{weekDeadlines.length} Items</span>
          </div>
          {weekDeadlines.map((d, i) => {
            const urgency = getUrgencyLevel(d.due_date);
            return (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="item-row">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="legend-pill lecture" style={{ fontSize: 9, background: d.courseColor + '22', color: d.courseColor }}>{d.courseId}</span>
                    {'source' in d && d.source === 'bot' && <span className="urgency-badge warning" style={{ fontSize: 9 }}>BOT</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.title}</span>
                  </div>
                  {d.note && <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>{d.note}</div>}
                </div>
                <span className={`urgency-badge ${urgency}`}>{formatTimeUntil(d.due_date)}</span>
              </a>
            );
          })}
        </div>
      )}

      {/* 📚 Core Study Decks */}
      <div className="card-box">
        <div className="card-box-header">
          <span>📚 Core Study Decks & Lecture Slides</span>
          <span>{lectureResources.length} Files</span>
        </div>
        {lectureResources.slice(0, 10).map((res, i) => (
          <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="item-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="legend-pill lecture" style={{ fontSize: 10 }}>{res.courseId}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{res.title}</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{formatRelativeTime(res.uploaded_at)}</span>
          </a>
        ))}
      </div>

      {/* 📢 Administrative Notice Board (Collapsed Noise Accordion) */}
      <div className="card-box">
        <button
          onClick={() => setShowNotices(!showNotices)}
          className="card-box-header"
          style={{ width: '100%', cursor: 'pointer' }}
        >
          <span>📢 Administrative Notices & Seatings ({noticeResources.length})</span>
          <span>{showNotices ? '▲ Hide' : '▼ View Notices'}</span>
        </button>
        {showNotices && (
          <div>
            {noticeResources.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                No administrative notices.
              </div>
            ) : (
              noticeResources.map((res, i) => (
                <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="item-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="legend-pill lab" style={{ fontSize: 10 }}>{res.courseId}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>{res.title}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Notice</span>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
