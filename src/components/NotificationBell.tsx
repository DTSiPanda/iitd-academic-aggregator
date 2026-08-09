'use client';

import { useState, useEffect, useRef } from 'react';
import { AggregatorData } from '@/types/schema';

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

function buildItemId(courseId: string, title: string, uploadedAt: string) {
  return `${courseId}::${title}::${uploadedAt}`;
}

function getFileIcon(title: string, type: string) {
  const t = title.toLowerCase();
  if (t.endsWith('.pdf')) return '📑';
  if (t.includes('slide') || t.includes('lecture')) return '📊';
  if (t.includes('lab') || t.includes('sheet')) return '🔬';
  if (type === 'url') return '🔗';
  return '📄';
}

function formatRelative(dateStr: string) {
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

  const allNewItems = (data.courses ?? []).flatMap(course =>
    (course.new_items ?? []).map(item => ({
      ...item,
      courseId: course.id,
      courseName: course.name,
      courseColor: (course as any).color ?? '#4f8ef7',
      itemId: buildItemId(course.id, item.title, (item as any).uploaded_at ?? ''),
    }))
  );

  const unseenCount = allNewItems.filter(i => !seenIds.has(i.itemId)).length;

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

  const byCourse = allNewItems.reduce<Record<string, typeof allNewItems>>((acc, item) => {
    if (!acc[item.courseId]) acc[item.courseId] = [];
    acc[item.courseId].push(item);
    return acc;
  }, {});

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        title="New uploads this week"
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8,
          background: open ? 'rgba(56,189,248,0.15)' : '#1e293b',
          border: `1px solid ${open ? '#38bdf840' : '#334155'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, transition: 'all 0.15s ease',
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

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 340,
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 999,
          maxHeight: '70vh', overflowY: 'auto',
          animation: 'bellDropIn 0.18s ease',
        }}>
          <style>{`
            @keyframes bellDropIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div style={{
            padding: '14px 16px 10px', borderBottom: '1px solid #334155',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>New This Week</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {allNewItems.length === 0
                  ? 'No new uploads yet'
                  : `${allNewItems.length} item${allNewItems.length > 1 ? 's' : ''} across ${Object.keys(byCourse).length} course${Object.keys(byCourse).length > 1 ? 's' : ''}`}
              </div>
            </div>
            {allNewItems.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: 'rgba(244,63,94,0.15)', color: '#f43f5e', borderRadius: 6, padding: '3px 8px',
              }}>
                {allNewItems.length} NEW
              </span>
            )}
          </div>

          {allNewItems.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              Nothing new uploaded yet.
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {Object.entries(byCourse).map(([courseId, items]) => (
                <div key={courseId}>
                  <div style={{ padding: '6px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: items[0].courseColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {courseId}
                    </span>
                  </div>
                  {items.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                        textDecoration: 'none',
                        background: seenIds.has(item.itemId) ? 'transparent' : 'rgba(56,189,248,0.04)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = seenIds.has(item.itemId) ? 'transparent' : 'rgba(56,189,248,0.04)')}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{getFileIcon(item.title, (item as any).type ?? '')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                          {formatRelative((item as any).uploaded_at ?? '')}
                        </div>
                      </div>
                      {!seenIds.has(item.itemId) && (
                        <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>
                          NEW
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          )}

          {allNewItems.length > 0 && (
            <div style={{ borderTop: '1px solid #334155', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { const e = new Set<string>(); saveSeenSet(e); setSeenIds(e); }}
                style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Mark all unread
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
