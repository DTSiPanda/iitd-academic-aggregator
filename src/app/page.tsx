'use client';

import { useEffect, useState, useCallback } from 'react';
import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import { fetchData, fetchOverrides, formatSyncAge } from '@/lib/fetchData';
import dynamic from 'next/dynamic';
import GroupSelectorModal from '@/components/GroupSelectorModal';
import GlobalSearch from '@/components/GlobalSearch';
import SemesterTimelineHeader from '@/components/SemesterTimelineHeader';

const TodayTab    = dynamic(() => import('@/components/tabs/TodayTab'));
const WeekTab     = dynamic(() => import('@/components/tabs/WeekTab'));
const CoursesTab  = dynamic(() => import('@/components/tabs/CoursesTab'));
const CalendarTab = dynamic(() => import('@/components/tabs/CalendarTab'));

const STORAGE_GROUP = 'iitd_lab_group';

type Tab = 'today' | 'week' | 'courses' | 'calendar';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today',    label: 'Today',     icon: '⚡' },
  { id: 'week',     label: 'This Week',  icon: '🗓' },
  { id: 'courses',  label: 'Courses',   icon: '📚' },
  { id: 'calendar', label: 'Calendar',  icon: '📅' },
];

function SyncBadge({ lastUpdated }: { lastUpdated: string }) {
  const [info, setInfo] = useState(formatSyncAge(lastUpdated));
  useEffect(() => {
    const id = setInterval(() => setInfo(formatSyncAge(lastUpdated)), 30000);
    return () => clearInterval(id);
  }, [lastUpdated]);
  return (
    <div className={`sync-badge ${info.status}`}>
      <span className="sync-dot" />
      Sync {info.text}
    </div>
  );
}

const EMPTY_OVERRIDES: Overrides = { cancellations: [], deadline_overrides: [], exams: [], notes: [], flagged: [], lab_done: [] };

export default function App() {
  const [data, setData]           = useState<AggregatorData | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(EMPTY_OVERRIDES);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [labGroup, setLabGroup]   = useState<LabGroup | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(() => setError('Could not load data.json. Run the scraper first.'))
      .finally(() => setLoading(false));

    fetchOverrides().then(setOverrides);

    // Live sync: poll for new Telegram bot overrides every 8 seconds
    const interval = setInterval(() => {
      fetchOverrides().then(setOverrides);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_GROUP) as LabGroup | null;
    if (saved) setLabGroup(saved);
    else setShowModal(true);
  }, []);

  const handleGroupSelect = useCallback((g: LabGroup) => {
    setLabGroup(g);
    localStorage.setItem(STORAGE_GROUP, g);
    setShowModal(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>Loading IITD Timetable Data…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 12, padding: 24 }}>
        <div style={{ fontSize: 44 }}>⚠️</div>
        <h2 style={{ color: '#0f172a', fontSize: 20, fontWeight: 800 }}>Data Unavailable</h2>
        <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', maxWidth: 360 }}>{error ?? 'Something went wrong.'}</p>
      </div>
    );
  }

  const groupLabel = labGroup ? `Group ${labGroup.replace('group', '')}` : 'Select Group';

  return (
    <div className="app-shell">
      {showModal && <GroupSelectorModal onSelect={handleGroupSelect} />}
      <GlobalSearch data={data} isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* ── PDF-Style Header Banner ── */}
      <header className="header-banner">
        <div className="header-banner-inner">
          <div>
            <div className="header-institution">Indian Institute of Technology Delhi</div>
            <h1 className="header-title-text">Civil Engineering B.Tech — Schedule (Semester 1, 2026–2027)</h1>
          </div>
          <div className="header-badges">
            {/* Search Bar Trigger */}
            <button
              onClick={() => setShowSearch(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <span>🔍 Search slides...</span>
              <kbd style={{ background: '#f1f5f9', padding: '2px 5px', borderRadius: 4, fontSize: 10, border: '1px solid #cbd5e1' }}>Ctrl K</kbd>
            </button>

            <SyncBadge lastUpdated={data.last_updated} />
            <button className="group-pill" onClick={() => setShowModal(true)}>
              🔬 {groupLabel} ✎
            </button>
          </div>
        </div>
      </header>

      {/* ── Temporal Progress & Milestone Countdown Bar ── */}
      <SemesterTimelineHeader timeline={data.semester_timeline} />

      {/* ── Navy Navigation Bar ── */}
      <nav className="nav-bar">
        <div className="nav-bar-inner">
          <div className="tab-group">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Timetable Legend Pills */}
          <div className="nav-legend">
            <span className="legend-pill lecture">
              <span className="legend-dot lecture" />
              Lecture
            </span>
            <span className="legend-pill lab">
              <span className="legend-dot lab" />
              Lab
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main Tab Content ── */}
      <main className="tab-content">
        {activeTab === 'today' && labGroup && (
          <TodayTab data={data} labGroup={labGroup} overrides={overrides} />
        )}
        {activeTab === 'week' && labGroup && (
          <WeekTab data={data} labGroup={labGroup} overrides={overrides} />
        )}
        {activeTab === 'courses' && (
          <CoursesTab courses={data.courses} overrides={overrides} />
        )}
        {activeTab === 'calendar' && labGroup && (
          <CalendarTab data={data} labGroup={labGroup} />
        )}
      </main>

      {/* ── PDF-Style Footer ── */}
      <footer className="app-footer">
        IIT Delhi Civil Engineering Timetable • Semester 1, 2026–2027
      </footer>
    </div>
  );
}
