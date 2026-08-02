import { LabGroup } from '@/types/schema';

export interface Slot {
  course: string;
  code: string;
  time: string;
  venue: string;
  type: 'lecture' | 'lab';
  days?: string[];
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const LECTURE_SLOTS: Slot[] = [
  { course: 'Surveying & RS',          code: 'CVL1301', time: '8:00 AM',  venue: 'WS 101 (SeNSE)', type: 'lecture', days: ['Monday', 'Thursday'] },
  { course: 'Climate Change',          code: 'CVL2001', time: '12:00 PM', venue: 'LH 108',          type: 'lecture', days: ['Monday', 'Tuesday', 'Friday'] },
  { course: 'Geological Engg',         code: 'CVL2401', time: '11:00 AM', venue: 'Block VI LT 2',   type: 'lecture', days: ['Tuesday', 'Friday'] },
  { course: 'Structures',              code: 'CVL2502', time: '10:00 AM', venue: 'WS 101 (SeNSE)',  type: 'lecture', days: ['Tuesday', 'Wednesday', 'Friday'] },
  { course: 'Traffic & Transport',     code: 'CVL2601', time: '9:00 AM',  venue: 'LH 416',          type: 'lecture', days: ['Tuesday', 'Wednesday', 'Friday'] },
  { course: 'Hydraulics',              code: 'CVL2702', time: '8:00 AM',  venue: 'LH 416',          type: 'lecture', days: ['Tuesday', 'Wednesday', 'Friday'] },
  { course: 'Eng Systems (Lec)',       code: 'MEP1000', time: '5:00 PM',  venue: 'Dogra Hall',      type: 'lecture', days: ['Tuesday'] },
];

export const LAB_SLOTS_BY_GROUP: Record<LabGroup, Slot[]> = {
  group1: [
    { course: 'Solid Mechanics Lab',   code: 'CVP2502', time: '3:00 PM', venue: 'Block V, Rm 216',   type: 'lab', days: ['Monday'] },
    { course: 'Traffic Lab',           code: 'CVP2601', time: '3:00 PM', venue: 'Comp Lab 4-A-8',     type: 'lab', days: ['Tuesday'] },
    { course: 'Geology Lab',           code: 'CVP2401', time: '1:00 PM', venue: 'Block IV, Rm 331',  type: 'lab', days: ['Thursday'] },
    { course: 'Hydraulics Lab',        code: 'CVP2702', time: '3:00 PM', venue: 'Block V, V312',      type: 'lab', days: ['Thursday'] },
    { course: 'Eng Systems Lab',       code: 'MEP1000', time: '9:00 AM', venue: 'CSC',                type: 'lab', days: ['Monday'] },
  ],
  group2: [
    { course: 'Solid Mechanics Lab',   code: 'CVP2502', time: '3:00 PM', venue: 'Block V, Rm 216',   type: 'lab', days: ['Tuesday'] },
    { course: 'Traffic Lab',           code: 'CVP2601', time: '3:00 PM', venue: 'Comp Lab 4-A-8',     type: 'lab', days: ['Thursday'] },
    { course: 'Geology Lab',           code: 'CVP2401', time: '1:00 PM', venue: 'Block IV, Rm 331',  type: 'lab', days: ['Friday'] },
    { course: 'Hydraulics Lab',        code: 'CVP2702', time: '3:00 PM', venue: 'Block V, V312',      type: 'lab', days: ['Friday'] },
    { course: 'Eng Systems Lab',       code: 'MEP1000', time: '9:00 AM', venue: 'CSC',                type: 'lab', days: ['Monday'] },
  ],
  group3: [
    { course: 'Geology Lab',           code: 'CVP2401', time: '1:00 PM', venue: 'Block IV, Rm 331',  type: 'lab', days: ['Monday'] },
    { course: 'Hydraulics Lab',        code: 'CVP2702', time: '3:00 PM', venue: 'Block V, V312',      type: 'lab', days: ['Monday'] },
    { course: 'Solid Mechanics Lab',   code: 'CVP2502', time: '3:00 PM', venue: 'Block V, Rm 216',   type: 'lab', days: ['Thursday'] },
    { course: 'Traffic Lab',           code: 'CVP2601', time: '3:00 PM', venue: 'Comp Lab 4-A-8',     type: 'lab', days: ['Friday'] },
    { course: 'Eng Systems Lab',       code: 'MEP1000', time: '9:00 AM', venue: 'CSC',                type: 'lab', days: ['Thursday'] },
  ],
  group4: [
    { course: 'Traffic Lab',           code: 'CVP2601', time: '3:00 PM', venue: 'Comp Lab 4-A-8',     type: 'lab', days: ['Monday'] },
    { course: 'Geology Lab',           code: 'CVP2401', time: '1:00 PM', venue: 'Block IV, Rm 331',  type: 'lab', days: ['Tuesday'] },
    { course: 'Hydraulics Lab',        code: 'CVP2702', time: '3:00 PM', venue: 'Block V, V312',      type: 'lab', days: ['Tuesday'] },
    { course: 'Solid Mechanics Lab',   code: 'CVP2502', time: '3:00 PM', venue: 'Block V, Rm 216',   type: 'lab', days: ['Friday'] },
    { course: 'Eng Systems Lab',       code: 'MEP1000', time: '9:00 AM', venue: 'CSC',                type: 'lab', days: ['Thursday'] },
  ],
};

export const COURSE_COLORS: Record<string, string> = {
  CVL1301: '#6366f1', CVL2001: '#10b981', CVL2401: '#f59e0b',
  CVL2502: '#3b82f6', CVL2601: '#8b5cf6', CVL2702: '#0ea5e9',
  MEP1000: '#64748b', CVP2401: '#d97706', CVP2502: '#2563eb',
  CVP2601: '#7c3aed', CVP2702: '#0284c7',
};

export const TIME_ORDER: Record<string, number> = {
  '8:00 AM': 800, '9:00 AM': 900, '10:00 AM': 1000, '11:00 AM': 1100,
  '12:00 PM': 1200, '1:00 PM': 1300, '3:00 PM': 1500, '5:00 PM': 1700,
};
