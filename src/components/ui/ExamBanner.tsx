import React from 'react';
import { ExamEntry } from '@/types/schema';

interface Props {
  exam: ExamEntry;
}

export default function ExamBanner({ exam }: Props) {
  const days = Math.ceil((new Date(exam.start_date).getTime() - new Date().getTime()) / 86400000);
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
      border: '2px solid #f59e0b',
      borderRadius: 12, padding: '12px 16px', marginBottom: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>📝 Upcoming Exam</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#78350f', marginTop: 2 }}>{exam.name}</div>
        <div style={{ fontSize: 11, color: '#92400e' }}>{exam.start_date} → {exam.end_date}</div>
      </div>
      <div style={{
        background: days <= 7 ? '#ef4444' : days <= 14 ? '#f59e0b' : '#10b981',
        color: '#fff', borderRadius: 20, padding: '6px 12px',
        fontSize: 13, fontWeight: 900
      }}>
        {days > 0 ? `${days}d` : 'TODAY'}
      </div>
    </div>
  );
}
