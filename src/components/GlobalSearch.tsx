'use client';

import { useState, useEffect, useRef } from 'react';
import { AggregatorData, Resource, Assignment } from '@/types/schema';

interface Props {
  data: AggregatorData;
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  type: 'slide' | 'assignment' | 'course';
  title: string;
  courseId: string;
  courseName: string;
  url: string;
  extra?: string;
}

export default function GlobalSearch({ data, isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const results: SearchResult[] = [];

  if (q.length > 0) {
    (data.courses ?? []).forEach(c => {
      // Check course match
      if (c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
        results.push({
          type: 'course',
          title: c.name,
          courseId: c.id,
          courseName: c.name,
          url: c.url,
          extra: `${c.new_items?.length ?? 0} materials`,
        });
      }

      // Check file/slide matches
      (c.new_items ?? []).forEach(item => {
        if (item.title.toLowerCase().includes(q)) {
          results.push({
            type: 'slide',
            title: item.title,
            courseId: c.id,
            courseName: c.name,
            url: item.url,
            extra: item.type === 'url' ? 'Link' : 'File / Slide',
          });
        }
      });

      // Check assignment matches
      (c.assignments ?? []).forEach(a => {
        if (a.title.toLowerCase().includes(q)) {
          results.push({
            type: 'assignment',
            title: a.title,
            courseId: c.id,
            courseName: c.name,
            url: a.url,
            extra: a.due_date_raw ? `Due: ${a.due_date_raw}` : 'Assignment',
          });
        }
      });
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 650, padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid #cbd5e1' }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            type="text"
            placeholder="Search slides, lectures, assignments, or course codes..."
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              debounceTimer.current = setTimeout(() => setQuery(e.target.value), 200);
            }}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontWeight: 600,
              color: '#0f172a',
              background: 'transparent',
            }}
          />
          <button
            onClick={onClose}
            style={{ padding: '4px 8px', borderRadius: 4, background: '#e2e8f0', fontSize: 11, fontWeight: 700, color: '#475569' }}
          >
            ESC
          </button>
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 12 }}>
          {q.length === 0 ? (
            <div style={{ padding: 30, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
              Type a keyword like <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>hydraulics</code>, <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>lab sheet</code>, or <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>CVL2502</code>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No matches found for &quot;{query}&quot;
            </div>
          ) : (
            results.slice(0, 15).map((res, i) => (
              <a
                key={i}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="item-row"
                style={{ borderRadius: 8, margin: '4px 0', border: '1px solid #e2e8f0' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="legend-pill lecture" style={{ fontSize: 10 }}>{res.courseId}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{res.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{res.courseName}</div>
                  </div>
                </div>
                <span className="urgency-badge safe" style={{ fontSize: 10 }}>{res.extra}</span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
