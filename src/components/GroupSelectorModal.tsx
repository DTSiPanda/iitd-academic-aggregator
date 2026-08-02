'use client';
import { LabGroup } from '@/types/schema';

interface Props {
  onSelect: (group: LabGroup) => void;
}

const GROUPS: { id: LabGroup; num: string; label: string }[] = [
  { id: 'group1', num: '1', label: 'Group 1' },
  { id: 'group2', num: '2', label: 'Group 2' },
  { id: 'group3', num: '3', label: 'Group 3' },
  { id: 'group4', num: '4', label: 'Group 4' },
];

export default function GroupSelectorModal({ onSelect }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">🔬</div>
        <h2 className="modal-title">Which lab group are you in?</h2>
        <p className="modal-sub">
          Your lab schedule differs by group. Select once and we'll remember it.
          You can change it anytime from the top bar.
        </p>
        <div className="group-grid">
          {GROUPS.map(g => (
            <button key={g.id} className="group-btn" onClick={() => onSelect(g.id)}>
              <span className="group-btn-num">{g.num}</span>
              <span className="group-btn-label">{g.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
