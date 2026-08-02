# IITD Civil Engineering Timetable Design System

This design specification documents the color tokens, typography, visual hierarchy, and component patterns extracted directly from the official Civil Engineering B.Tech Semester 1 (2026–2027) timetable (`c:\Users\tejas\Desktop\timetable\app.jsx`).

---

## 🎨 Color Tokens & Palette

### Base & Backgrounds
| Role | Class / Value | Hex | Description |
|---|---|---|---|
| **Page Background** | `bg-slate-100` | `#f1f5f9` | Light cool slate background |
| **Card / Sheet Fill** | `bg-white` | `#ffffff` | Clean white surface |
| **Section Header BG** | `bg-gradient-to-br from-indigo-50 via-slate-100 to-blue-50` | `#eef2ff` | Subtle blue gradient header |
| **Borders** | `border-slate-300` / `border-indigo-200` | `#cbd5e1` / `#c7d2fe` | Crisp separation lines |
| **Primary Text** | `text-slate-900` | `#0f172a` | High-contrast body text |
| **Secondary Text** | `text-slate-600` | `#475569` | Muted labels and timestamps |

---

## 📚 Course Block Styling

### 1. Lecture Blocks (`Lec`)
Used for standard lecture slots across all courses (`CVL1301`, `CVL2001`, `CVL2401`, `CVL2502`, `CVL2601`, `CVL2702`, `MEP1000`).

- **Background**: `bg-indigo-50` (`#e0e7ff` / `#eeeffe`)
- **Left Accent Border**: `border-l-4 border-indigo-600` (`#4f46e5`)
- **Outer Border**: `border border-indigo-200` (`#c7d2fe`)
- **Title Text**: `font-extrabold text-indigo-950` (`#1e1b4b`)
- **Venue / Subtitle**: `text-[10px] text-indigo-700 font-medium` (`#4338ca`)
- **"New" / Status Pill**: `bg-emerald-200 text-emerald-900 px-1 rounded font-bold text-[9px]`

```jsx
<div className="bg-indigo-50 border-l-4 border-indigo-600 border border-indigo-200 p-1.5 rounded shadow-sm">
  <div className="font-extrabold text-indigo-950">CVL2702</div>
  <div className="text-[10px] text-indigo-700 font-medium">LH 416</div>
</div>
```

---

### 2. Lab Blocks (`Lab` / `Practical`)
Used for lab sessions (`CVP2401`, `CVP2502`, `CVP2601`, `CVP2702`, `MEP1000 Lab`).

- **Background**: `bg-amber-50` (`#fffbeb` / `#fef3c7`)
- **Left Accent Border**: `border-l-4 border-amber-500` (`#f59e0b`)
- **Outer Border**: `border border-amber-200` (`#fde68a`)
- **Title Text**: `font-bold text-amber-950` (`#451a03`)
- **Venue / Subtitle**: `text-[10px] text-amber-800 font-medium` (`#92400e`)
- **Group Badge**: `bg-amber-200 text-amber-900 px-1 rounded font-bold text-[9px]`

```jsx
<div className="bg-amber-50 border-l-4 border-amber-500 border border-amber-200 p-1.5 rounded shadow-sm">
  <div className="font-bold text-amber-950">CVP2401 (Group 1)</div>
  <div className="text-[10px] text-amber-800 font-medium">Block IV, Rm 331</div>
</div>
```

---

## 🗓 Table Grid Specifications

### Header & Day Column
- **Table Header**: `bg-slate-800 text-slate-100 font-bold text-center` (`#1e293b`)
- **Day Label Column**: `bg-slate-200/80 text-slate-900 font-black text-center text-sm uppercase p-2 border-r-2 border-slate-400`
- **Lectures Row Label**: `bg-indigo-100 text-indigo-950 font-bold text-center p-1.5 uppercase text-[10px]`
- **Labs Row Label**: `bg-amber-100 text-amber-950 font-bold text-center p-1.5 uppercase text-[10px]`

---

## 📋 Legend Badges

- **Lecture Badge**: `bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold px-2 py-0.5 rounded`
- **Lab Badge**: `bg-amber-50 border border-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded`
- **Confirmed Badge**: `bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold px-2 py-0.5 rounded`

---

## 💡 Application Consistency Guidelines

1. **Strict Color Scoping**: Always use Indigo (`#4f46e5`) for lecture items and Amber (`#f59e0b`) for lab items.
2. **Left Accent Border**: Every card block (lecture, lab, deadline, or upload) should feature a 3px/4px left accent border matching its type.
3. **Card Fill & Borders**: Pair light background fills (`bg-indigo-50`, `bg-amber-50`) with subtle 1px matching borders (`border-indigo-200`, `border-amber-200`).
4. **Header Style**: Use the gradient header style (`bg-gradient-to-br from-indigo-50 via-slate-100 to-blue-50`) for page titles and section highlights.
