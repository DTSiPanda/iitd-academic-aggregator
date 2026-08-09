'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AggregatorData, Resource } from '@/types/schema';

interface Props {
  data: AggregatorData;
}

const STORAGE_KEY = 'iitd_seen_items';

function getSeenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenSet(s: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {}
}

function buildItemId(courseId: string, res: Resource) {
  return `${courseId}::${res.title}::${res.uploaded_at}`;
}

function getFileIcon(res: Resource): string {
  const t = res.title.toLowerCase();
  if (t.endsWith('.pdf')) return '📑';
  if (t.includes('slide') || t.includes('lecture')) return '📊';
  if (t.includes('lab') || t.includes('sheet')) return '🔬';
  if (res.type === 'url') return '🔗';
  return '📄';
}

function formatRelative(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default function NotificationBell({ data }: Props) {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeenIds(getSeenSet());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allNewItems = useMemo(() =>
    (data.courses ?? []).flatMap(course =>
      (course.new_items ?? []).map(item => ({
        ...item,
        courseId: course.id,
        courseColor: course.color,
        itemId: buildItemId(course.id, item),
      }))
    ),
    [data.courses]
  );

  const byCourse = useMemo(() =>
    allNewItems.reduce<Record<string, typeof allNewItems>>((acc, item) => {
      if (!acc[item.courseId]) acc[item.courseId] = [];
      acc[item.courseId].push(item);
      return acc;
    }, {}),
    [allNewItems]
  );

  const unseenCount = useMemo(
    () => allNewItems.filter(i => !seenIds.has(i.itemId)).length,
    [allNewItems, seenIds]
  );

  function handleOpen() {
    setOpen(v => {
      if (!v) {
        const newSeen = new Set(seenIds);
        allNewItems.forEach(i => newSeen.add(i.itemId));
        saveSeenSet(newSeen);
        setSeenIds(newSeen);
      }
      return !v;
    });
  }

  const totalCourses = Object.keys(byCourse).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        title="New uploads this week"
        aria-label={`Notifications${unseenCount > 0 ? `, ${unseenCount} unread` : ''}`}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8,
          background: open ? 'rgba(56,189,248,0.15)' : '#1e293b',
          border: `1px solid ${open ? '#38bdf840' : '#334155'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, transition: 'all 0.15s ease', flexShrink: 0,
        }}
      >
        🔔
        {unseenCount > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 900,
            borderRadius: 999, minWidth: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', boxShadow: '0 0 0 2px #0f172a', lineHeight: 1,
          }}>
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>

      {/* Dropdown — fixed positioning so it never clips off-screen on mobile */}
      {open && (
        <>
          {/* Backdrop for mobile tap-to-close */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'fixed',
            top: 60,
            right: 12,
            width: 'min(340px, calc(100vw - 24px))',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            zIndex: 999,
            maxHeight: 'min(70vh, 480px)',
            overflowY: 'auto',
            animation: 'bellDropIn 0.18s ease',
          }}>
            <style>{`
              @keyframes bellDropIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            {/* Header */}
            <div style={{
              padding: '12px 14px 10px',
              borderBottom: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>New This Week</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {allNewItems.length === 0
                    ? 'No new uploads yet'
                    : `${allNewItems.length} file${allNewItems.length > 1 ? 's' : ''} · ${totalCourses} course${totalCourses > 1 ? 's' : ''}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {allNewItems.length > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    background: 'rgba(244,63,94,0.15)', color: '#f43f5e',
                    borderRadius: 6, padding: '3px 7px',
                  }}>
                    {unseenCount > 0 ? `${unseenCount} NEW` : 'ALL SEEN'}
                  </span>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'none', border: 'none', color: '#64748b',
                    cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            {allNewItems.length === 0 ? (
              <div style={{ padding: '28px 14px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                Nothing new uploaded yet.
              </div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {Object.entries(byCourse).map(([courseId, items]) => (
                  <div key={courseId}>
                    {/* Course label */}
                    <div style={{
                      padding: '5px 14px 3px',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: items[0].courseColor, flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 10, fontWeight: 900, color: '#94a3b8',
                        letterSpacing: 0.5, textTransform: 'uppercase',
                      }}>
                        {courseId}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
                        {items.length} file{items.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* File rows */}
                    {items.map((item, i) => {
                      const unseen = !seenIds.has(item.itemId);
                      return (
                        <a
                          key={i}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 14px',
                            textDecoration: 'none',
                            background: unseen ? 'rgba(56,189,248,0.05)' : 'transparent',
                            borderLeft: unseen ? '2px solid #38bdf8' : '2px solid transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{getFileIcon(item)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: unseen ? 700 : 500,
                              color: unseen ? '#e2e8f0' : '#94a3b8',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                              {formatRelative(item.uploaded_at)}
                            </div>
                          </div>
                          {unseen && (
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: '#38bdf8', flexShrink: 0,
                            }} />
                          )}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {allNewItems.length > 0 && (
              <div style={{
                borderTop: '1px solid #334155',
                padding: '8px 14px',
                display: 'flex', justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => {
                    const empty = new Set<string>();
                    saveSeenSet(empty);
                    setSeenIds(empty);
                  }}
                  style={{
                    fontSize: 11, fontWeight: 700, color: '#64748b',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  Mark all as unread
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
