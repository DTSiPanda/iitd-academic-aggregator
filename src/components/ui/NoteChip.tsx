import React from 'react';
import { NoteEntry } from '@/types/schema';

interface Props {
  note: NoteEntry;
}

export default function NoteChip({ note }: Props) {
  const colorMap: Record<NoteEntry['priority'], { text: string; bg: string }> = {
    high:   { text: '#dc2626', bg: '#fef2f2' },
    medium: { text: '#d97706', bg: '#fffbeb' },
    low:    { text: '#3b82f6', bg: '#eff6ff' },
  };

  const style = colorMap[note.priority] || colorMap.medium;

  return (
    <div style={{
      fontSize: 11, fontWeight: 600, marginTop: 5,
      color: style.text, background: style.bg,
      padding: '3px 8px', borderRadius: 6, display: 'inline-block'
    }}>
      {note.priority === 'high' ? '🔴' : note.priority === 'medium' ? '🟡' : '🔵'} {note.text}
    </div>
  );
}
