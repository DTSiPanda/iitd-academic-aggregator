import { Course, Resource } from '@/types/schema';
import { formatRelativeTime } from '@/lib/fetchData';

interface Props {
  courses: Course[];
  activeCourses: Set<string>;
}

const FILE_ICONS: Record<string, string> = {
  file: '📄',
  url: '🔗',
};

function getFileIcon(res: Resource): string {
  const t = res.title.toLowerCase();
  if (t.endsWith('.pdf')) return '📑';
  if (t.includes('slide') || t.includes('lecture')) return '📊';
  if (t.includes('lab') || t.includes('sheet') || t.includes('worksheet')) return '🔬';
  if (res.type === 'url') return '🔗';
  return '📄';
}

export default function NewItemsFeed({ courses, activeCourses }: Props) {
  const filtered = courses.filter(c => activeCourses.has(c.id) && c.new_items.length > 0);
  const totalItems = filtered.reduce((s, c) => s + c.new_items.length, 0);
  const newCount = filtered.reduce((s, c) => s + c.new_items.filter(r => r.is_new).length, 0);

  return (
    <div className="section-card">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon" style={{ background: 'rgba(79,142,247,0.15)', color: '#4f8ef7' }}>🆕</span>
          New This Week
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {newCount > 0 && (
            <span className="new-badge">{newCount} NEW</span>
          )}
          <span className="section-count">{totalItems} items</span>
        </div>
      </div>
      <div className="section-body">
        {filtered.length === 0 ? (
          <div className="section-empty">
            <div style={{ fontSize: 32 }}>🎉</div>
            <p>No new uploads yet. Check back later.</p>
          </div>
        ) : (
          filtered.map(course => (
            <div key={course.id} className="resource-group">
              <div className="resource-group-header">
                <span className="resource-group-dot" style={{ background: course.color }} />
                <span className="resource-group-name">{course.id} — {course.name}</span>
              </div>
              {course.new_items.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-item"
                >
                  <div className="resource-icon">{getFileIcon(res)}</div>
                  <div className="resource-info">
                    <div className="resource-title">{res.title}</div>
                    <div className="resource-meta">{formatRelativeTime(res.uploaded_at)}</div>
                  </div>
                  {res.is_new && <span className="new-badge">NEW</span>}
                </a>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
