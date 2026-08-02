'use client';
import { Course } from '@/types/schema';

interface Props {
  courses: Course[];
  active: Set<string>;
  onToggle: (id: string) => void;
}

export default function CourseFilterBar({ courses, active, onToggle }: Props) {
  return (
    <div className="filter-bar">
      <span className="filter-label">Courses</span>
      {courses.map(course => (
        <button
          key={course.id}
          className={`filter-pill ${active.has(course.id) ? 'active' : ''}`}
          onClick={() => onToggle(course.id)}
          title={course.name}
        >
          <span className="dot" style={{ background: course.color }} />
          {course.id}
        </button>
      ))}
    </div>
  );
}
