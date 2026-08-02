'use client';

import { useState } from 'react';
import { AggregatorData, LabGroup } from '@/types/schema';
import { getUrgencyLevel, formatTimeUntil } from '@/lib/fetchData';

interface Props {
  data: AggregatorData;
  labGroup: LabGroup;
}

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarTab({ data, labGroup }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map deadlines to dates
  const deadlinesByDate: Record<string, { title: string; courseId: string; url: string; due_date: string | null }[]> = {};
  data.courses.forEach(c => {
    c.assignments.forEach(a => {
      if (!a.due_date) return;
      const d = new Date(a.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!deadlinesByDate[key]) deadlinesByDate[key] = [];
      deadlinesByDate[key].push({ title: a.title, courseId: c.id, url: a.url, due_date: a.due_date });
    });
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getKey = (d: number) => `${year}-${month}-${d}`;
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  const isSelected = (d: number) => selected?.getDate() === d && selected?.getMonth() === month && selected?.getFullYear() === year;

  // Selected day events
  const selectedKey = selected ? `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}` : '';
  const selectedDeadlines = deadlinesByDate[selectedKey] || [];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="calendar-layout">
      <div className="cal-card">
        <div className="cal-nav-bar">
          <button className="legend-pill lecture" onClick={prevMonth}>‹ Previous</button>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{MONTHS[month]} {year}</span>
          <button className="legend-pill lecture" onClick={nextMonth}>Next ›</button>
        </div>

        <div className="cal-grid-view">
          {DAYS_SHORT.map(d => (
            <div key={d} className="cal-header-cell">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ background: '#f8fafc' }} />;
            const dots = deadlinesByDate[getKey(d)] || [];
            return (
              <div
                key={i}
                className={`cal-day-cell ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''}`}
                onClick={() => setSelected(new Date(year, month, d))}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d}</span>
                {dots.length > 0 && (
                  <div className="cal-dot-indicator" style={{ background: '#e11d48' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cal-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>
          {selected ? selected.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) : 'Select Date'}
        </h3>
        {selectedDeadlines.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
            No deadlines scheduled for this date.
          </div>
        ) : (
          selectedDeadlines.map((ev, i) => (
            <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer" className="item-row" style={{ padding: '10px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{ev.title}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5' }}>{ev.courseId}</div>
              </div>
              <span className={`urgency-badge ${getUrgencyLevel(ev.due_date)}`}>
                {formatTimeUntil(ev.due_date)}
              </span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
