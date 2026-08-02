'use client';

import { useState, useMemo } from 'react';
import { Course, Resource, Overrides } from '@/types/schema';
import { getCourseNotes, getResourceUrl, formatTimeUntil, getUrgencyLevel } from '@/lib/fetchData';
import { COURSE_COLORS } from '@/lib/scheduleData';

interface Props {
  courses: Course[];
  overrides: Overrides;
}

function getFileIcon(res: Resource): string {
  const t = res.title.toLowerCase();
  if (t.includes('.pdf') || t.includes('slide') || t.includes('lecture')) return '📑';
  if (t.includes('lab') || t.includes('sheet') || t.includes('worksheet')) return '🔬';
  if (t.includes('assignment') || t.includes('quiz') || t.includes('test')) return '📝';
  if (res.type === 'url') return '🔗';
  return '📄';
}

export default function CoursesTab({ courses, overrides }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'lecture' | 'lab'>('all');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedCourse(prev => prev === id ? null : id);
  };

  // Filter courses based on tab selection
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const isLab = course.id.startsWith('CVP') || (course.id === 'MEP1000' && course.name.toLowerCase().includes('lab'));
      if (filterType === 'lecture' && isLab) return false;
      if (filterType === 'lab' && !isLab) return false;
      return true;
    });
  }, [courses, filterType]);

  const totalFiles = courses.reduce((acc, c) => acc + c.new_items.length, 0);
  const totalAssignments = courses.reduce((acc, c) => acc + c.assignments.length, 0);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Top Header Controls & Search ── */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px', marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              📚 Course Hub & Resources
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {courses.length} courses enrolled • {totalFiles} resources • {totalAssignments} assignments
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <button
            onClick={() => setFilterType('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: filterType === 'all' ? '#0f172a' : '#f1f5f9',
              color: filterType === 'all' ? '#fff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            All Courses ({courses.length})
          </button>
          <button
            onClick={() => setFilterType('lecture')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: filterType === 'lecture' ? '#2563eb' : '#f1f5f9',
              color: filterType === 'lecture' ? '#fff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            📖 Lectures ({courses.filter(c => !c.id.startsWith('CVP')).length})
          </button>
          <button
            onClick={() => setFilterType('lab')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: filterType === 'lab' ? '#d97706' : '#f1f5f9',
              color: filterType === 'lab' ? '#fff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            🔬 Practical Labs ({courses.filter(c => c.id.startsWith('CVP')).length})
          </button>
        </div>
      </div>

      {/* ── Courses Blocks Grid ── */}
      {filteredCourses.length === 0 ? (
        <div style={{
          background: '#fff', border: '2px dashed #cbd5e1', borderRadius: 16, padding: '40px 20px',
          textAlign: 'center', color: '#64748b'
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>No matching courses found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your search query or filter settings.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredCourses.map(course => {
            const isExpanded = expandedCourse === course.id;
            const color = COURSE_COLORS[course.id] || '#3b82f6';
            const isLab = course.id.startsWith('CVP');
            const newCount = course.new_items.filter(r => r.is_new).length;
            const courseNotes = getCourseNotes(overrides.notes, course.id);

            return (
              <div
                key={course.id}
                style={{
                  background: '#fff',
                  border: isExpanded ? `2px solid ${color}` : '1px solid #e2e8f0',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: isExpanded ? `0 6px 20px ${color}20` : '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                {/* ── Top Color Accent Strip ── */}
                <div style={{ height: 5, background: color }} />

                <div style={{ padding: '16px', flex: 1 }}>

                  {/* ── Block Header: Code + Badges ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 900, color: '#fff', background: color,
                        padding: '4px 10px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.5
                      }}>
                        {course.id}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                        background: isLab ? '#fef3c7' : '#e0e7ff',
                        color: isLab ? '#92400e' : '#3730a3'
                      }}>
                        {isLab ? 'Practical Lab' : 'Lecture'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {newCount > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 900, background: '#ef4444', color: '#fff',
                          padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase'
                        }}>
                          {newCount} NEW
                        </span>
                      )}
                      {course.credits && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 6 }}>
                          {course.credits} Cr
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Course Name ── */}
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                    {course.name}
                  </h3>

                  {/* ── Instructor & Venue ── */}
                  {(course.instructor || course.venue) && (
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                      {course.instructor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>👤</span>
                          <span>Instructor: <strong style={{ color: '#334155' }}>{course.instructor}</strong></span>
                        </div>
                      )}
                      {course.venue && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📍</span>
                          <span>Venue: <strong style={{ color: '#334155' }}>{course.venue}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Bot Notes Sticky Banner (if any) ── */}
                  {courseNotes.length > 0 && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {courseNotes.map((note, idx) => {
                        const noteColor = ({ high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' } as Record<string, string>)[note.priority];
                        return (
                          <div key={idx} style={{
                            fontSize: 11, fontWeight: 700, color: noteColor, background: noteColor + '12',
                            borderLeft: `3px solid ${noteColor}`, padding: '5px 8px', borderRadius: '0 6px 6px 0'
                          }}>
                            {note.priority === 'high' ? '🔴 ' : note.priority === 'medium' ? '🟡 ' : '🔵 '}
                            {note.text}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Stats Summary Bar ── */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', background: '#f8fafc', borderRadius: 10, fontSize: 12, color: '#475569', fontWeight: 600
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      📁 {course.new_items.length} Files
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      📝 {course.assignments.length} Assignments
                    </span>
                    <button
                      onClick={() => toggleExpand(course.id)}
                      style={{
                        background: isExpanded ? color : 'transparent',
                        color: isExpanded ? '#fff' : color,
                        border: `1px solid ${color}`,
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      {isExpanded ? 'Hide ▲' : 'View ▼'}
                    </button>
                  </div>

                </div>

                {/* ── Expanded Content Area ── */}
                {isExpanded && (
                  <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 16px' }}>

                    {/* Moodle Assignments Section */}
                    {course.assignments.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          📝 Assignments & Quizzes
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {course.assignments.map((a, i) => {
                            const urgency = getUrgencyLevel(a.due_date);
                            return (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0',
                                  borderRadius: 8, textDecoration: 'none'
                                }}
                              >
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.title}</span>
                                {a.due_date && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 800,
                                    color: urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#10b981'
                                  }}>
                                    {formatTimeUntil(a.due_date)}
                                  </span>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Course Resources / Files List */}
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      📄 Course Resources & Slides
                    </div>

                    {course.new_items.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                        No files uploaded on Moodle yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                        {course.new_items.map((res, i) => {
                          const isFlagged = overrides.flagged.some(
                            f => f.course === course.id && f.title === res.title
                          );
                          const directUrl = getResourceUrl(course.id, res);

                          return (
                            <a
                              key={i}
                              href={directUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 10px', background: isFlagged ? '#fffbeb' : '#fff',
                                border: isFlagged ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{getFileIcon(res)}</span>
                                <span style={{
                                  fontSize: 12, fontWeight: isFlagged ? 800 : 600, color: '#1e293b',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                  {isFlagged ? '⭐ ' : ''}{res.title}
                                </span>
                              </div>

                              {res.is_new && (
                                <span style={{
                                  fontSize: 9, fontWeight: 900, background: '#10b981', color: '#fff',
                                  padding: '1px 5px', borderRadius: 4, flexShrink: 0
                                }}>
                                  NEW
                                </span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}

                {/* ── Block Footer: Quick Links ── */}
                <div style={{
                  padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11, fontWeight: 800, color: color, background: color + '15',
                      padding: '5px 12px', borderRadius: 8, textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                  >
                    🌐 Open Moodle Course →
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
