'use client';

import { useEffect, useState, useCallback } from 'react';
import { AggregatorData, LabGroup, Overrides } from '@/types/schema';
import { fetchData, fetchOverrides } from '@/lib/fetchData';
import dynamic from 'next/dynamic';
import GroupSelectorModal from '@/components/GroupSelectorModal';
import GlobalSearch from '@/components/GlobalSearch';

const TodayTab    = dynamic(() => import('@/components/tabs/TodayTab'));
const WeekTab     = dynamic(() => import('@/components/tabs/WeekTab'));
const CoursesTab  = dynamic(() => import('@/components/tabs/CoursesTab'));
const CalendarTab = dynamic(() => import('@/components/tabs/CalendarTab'));

const STORAGE_GROUP = 'iitd_lab_group';

type Tab = 'today' | 'week' | 'courses' | 'calendar';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today',    label: 'Action Plans', icon: '⚡' },
  { id: 'week',     label: 'Timetable',    icon: '🗓' },
  { id: 'calendar', label: 'Calendar',     icon: '📅' },
  { id: 'courses',  label: 'Courses',      icon: '📚' },
];

import { supabase } from '@/lib/supabaseClient';

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

    const channel = supabase
      .channel('realtime_academic')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overrides' }, (payload: any) => {
        if (payload.new && payload.new.data) {
          setOverrides(payload.new.data);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moodle_data' }, (payload: any) => {
        if (payload.new && payload.new.data) {
          setData(payload.new.data);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <p style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>Loading IITD Academic Aggregator…</p>
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

      {/* ── Sleek Integrated Header ── */}
      <header style={{ background: '#0f172a', color: '#fff', borderBottom: '1px solid #1e293b' }}>
        <div style={{
          maxWidth: 1300, margin: '0 auto', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#38bdf8', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              IIT DELHI • B.TECH CIVIL
            </div>
            <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Academic Aggregator
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: '#cbd5e1', cursor: 'pointer'
              }}
            >
              <span>🔍 Search</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                background: '#38bdf815', color: '#38bdf8', border: '1px solid #38bdf840', cursor: 'pointer'
              }}
            >
              🔬 {groupLabel} ✎
            </button>
          </div>
        </div>

        {/* ── Sticky Tab Bar ── */}
        <nav style={{ background: '#1e293b', borderTop: '1px solid #334155' }}>
          <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', justifyContent: 'space-around' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: '1 1 0', padding: '10px 8px', fontSize: 12, fontWeight: 800,
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  borderBottom: activeTab === tab.id ? '3px solid #38bdf8' : '3px solid transparent',
                  background: activeTab === tab.id ? 'rgba(56,189,248,0.06)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', width: '100%', flex: 1, padding: '16px 12px' }}>
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
          <CalendarTab data={data} labGroup={labGroup} overrides={overrides} />
        )}
      </main>

      <footer style={{ background: '#0f172a', color: '#64748b', padding: '14px', textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
        IIT Delhi Civil Engineering • Semester 1 (2026–2027)
      </footer>
    </div>
  );
}
