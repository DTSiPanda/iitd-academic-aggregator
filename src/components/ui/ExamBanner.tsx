import React from 'react';
import { ExamEntry } from '@/types/schema';

interface Props {
  exams: ExamEntry[];
}

export default function ExamBanner({ exams }: Props) {
  const upcoming = exams
    .filter(e => new Date(e.end_date) >= new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (upcoming.length === 0) return null;

  const primary = upcoming[0];
  const days = Math.ceil((new Date(primary.start_date).getTime() - new Date().getTime()) / 86400000);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
      border: '2px solid #f59e0b',
      borderRadius: 14, padding: '14px 16px', marginBottom: 16,
      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>
            📝 NEXT EXAM MILESTONE
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#78350f', marginTop: 2 }}>
            {primary.name}
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
            📅 {primary.start_date} {primary.start_date !== primary.end_date ? `→ ${primary.end_date}` : ''}
            {primary.note && <span> • {primary.note}</span>}
          </div>
        </div>
        <div style={{
          background: days <= 7 ? '#ef4444' : days <= 14 ? '#f59e0b' : '#10b981',
          color: '#fff', borderRadius: 20, padding: '8px 14px',
          fontSize: 14, fontWeight: 900, flexShrink: 0, textAlign: 'center'
        }}>
          {days > 0 ? `In ${days}d` : 'TODAY'}
        </div>
      </div>

      {/* Subsequent Upcoming Exams list if more than 1 */}
      {upcoming.length > 1 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fde68a', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {upcoming.slice(1).map((e, idx) => {
            const d = Math.ceil((new Date(e.start_date).getTime() - new Date().getTime()) / 86400000);
            return (
              <div key={idx} style={{
                background: '#ffffff99', padding: '4px 10px', borderRadius: 8,
                fontSize: 11, color: '#78350f', fontWeight: 700, flex: '0 0 auto'
              }}>
                {e.name}: <strong>In {d}d</strong> ({e.start_date})
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
