'use client';
import { LabSchedules, LabGroup } from '@/types/schema';
import { getTodaysDayName, getCourseName } from '@/lib/fetchData';
import { Course } from '@/types/schema';

interface Props {
  labSchedules: LabSchedules;
  group: LabGroup;
  courses: Course[];
  onChangeGroup: () => void;
}

const GROUP_LABELS: Record<LabGroup, string> = {
  group1: 'Group 1',
  group2: 'Group 2',
  group3: 'Group 3',
  group4: 'Group 4',
};

const DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const NEXT_DATES: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
};

function getNextDateForDay(dayName: string): Date {
  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun
  const target = NEXT_DATES[dayName] ?? 1;
  let diff = target - todayDay;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 0; // today
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

export default function LabScheduleCard({ labSchedules, group, courses, onChangeGroup }: Props) {
  const slots = labSchedules[group] ?? [];
  const today = getTodaysDayName();

  const sorted = [...slots].sort((a, b) =>
    DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  );

  return (
    <div className="section-card lab-card">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon" style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>🔬</span>
          Lab Schedule
        </div>
        <button className="group-pill" onClick={onChangeGroup}>
          {GROUP_LABELS[group]} ✎
        </button>
      </div>
      <div className="section-body">
        {sorted.length === 0 ? (
          <div className="section-empty">
            <div style={{ fontSize: 32 }}>📋</div>
            <p>No lab slots found for {GROUP_LABELS[group]}.</p>
          </div>
        ) : (
          sorted.map((slot, i) => {
            const nextDate = getNextDateForDay(slot.day);
            const isToday = slot.day === today;
            const courseName = getCourseName(slot.course, courses);
            return (
              <div key={i} className={`lab-slot ${isToday ? 'today' : ''}`}>
                {isToday && <span className="today-pill">TODAY</span>}
                <div className="lab-day-col">
                  <div className="lab-day">{slot.day.slice(0, 3)}</div>
                  <div className="lab-date-num">{nextDate.getDate()}</div>
                </div>
                <div className="lab-divider" />
                <div className="lab-info">
                  <div className="lab-course-name">{slot.course}</div>
                  <div className="lab-time">{slot.time}</div>
                  <div className="lab-venue">📍 {slot.venue}</div>
                  {slot.note && <div className="lab-note">{slot.note}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
