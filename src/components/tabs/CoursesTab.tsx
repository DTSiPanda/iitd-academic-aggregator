'use client';

import { useState } from 'react';
import { Course, Resource, Overrides } from '@/types/schema';
import { getCourseNotes, getResourceUrl } from '@/lib/fetchData';

interface Props {
  courses: Course[];
  overrides: Overrides;
}

function getFileIcon(res: Resource): string {
  const t = res.title.toLowerCase();
  if (t.includes('.pdf') || t.includes('slide') || t.includes('lecture')) return '📑';
  if (t.includes('lab') || t.includes('sheet') || t.includes('worksheet')) return '🔬';
  if (res.type === 'url') return '🔗';
  return '📄';
}

export default function CoursesTab({ courses, overrides }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="courses-container">
      {courses.map(course => {
        const isOpen = expanded === course.id;
        const newCount = course.new_items.filter(r => r.is_new).length;
        const isLab = course.id.startsWith('CVP') || course.id.startsWith('MEP');

        return (
          <div key={course.id} className="course-item-card">
            <div className="course-item-header" onClick={() => toggle(course.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="course-code-tag">{course.id}</span>
                  <span className={`legend-pill ${isLab ? 'lab' : 'lecture'}`}>
                    {isLab ? 'Practical Lab' : 'Lecture'}
                  </span>
                  {course.credits && (
                    <span className="course-badge">{course.credits} Credits</span>
                  )}
                  {newCount > 0 && (
                    <span className="urgency-badge critical">{newCount} NEW</span>
                  )}
                </div>
                <div className="course-name-text">{course.name}</div>
                {course.instructor && (
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 4 }}>
                    👤 Instructor: <span style={{ color: '#0f172a' }}>{course.instructor}</span>
                    {course.venue && <span> • 📍 {course.venue}</span>}
                  </div>
                )}
              {/* Notes from bot overrides */}
              {getCourseNotes(overrides.notes, course.id).map((note, i) => {
                const color = ({ high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' } as Record<string, string>)[note.priority];
                return (
                  <div key={i} style={{ fontSize: 12, color, fontWeight: 700, marginTop: 4, padding: '4px 8px', background: color + '15', borderRadius: 6 }}>
                    {note.priority === 'high' ? '🔴' : note.priority === 'medium' ? '🟡' : '🔵'} {note.text}
                  </div>
                );
              })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="course-badge">{course.new_items.length} files</span>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div className="resource-list">
                {/* Course Hub Links Bar */}
                <div style={{ padding: '12px 20px', background: '#e2e8f0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Course Hub:</span>
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="legend-pill lecture"
                    style={{ fontSize: 11 }}
                  >
                    🌐 Open Moodle Course
                  </a>
                  <a
                    href="#"
                    onClick={e => { e.preventDefault(); alert(`WhatsApp Group link for ${course.id} can be configured in schedules.json`); }}
                    className="legend-pill lab"
                    style={{ fontSize: 11 }}
                  >
                    💬 WhatsApp Group
                  </a>
                  <a
                    href="#"
                    onClick={e => { e.preventDefault(); alert(`PYQ Drive Folder link for ${course.id} can be configured in schedules.json`); }}
                    className="legend-pill lecture"
                    style={{ fontSize: 11, background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                  >
                    📁 PYQ Drive Folder
                  </a>
                </div>

                {course.new_items.length === 0 ? (
                  <div style={{ padding: '16px 20px', fontSize: 13, color: '#64748b' }}>
                    No course resources uploaded yet on Moodle.
                  </div>
                ) : (
                  course.new_items.map((res, i) => {
                    const isFlagged = overrides.flagged.some(
                      f => f.course === course.id && f.title === res.title
                    );
                    return (
                      <a key={i} href={getResourceUrl(course.id, res)} target="_blank" rel="noopener noreferrer" className="resource-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>{getFileIcon(res)}</span>
                          <span>{isFlagged ? '⭐ ' : ''}{res.title}</span>
                        </div>
                        {res.is_new && <span className="urgency-badge safe">NEW</span>}
                      </a>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
