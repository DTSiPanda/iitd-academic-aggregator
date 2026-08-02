# IITD Academic Aggregator — Feature Roadmap & Future Plans

> **Mission**: Eliminate academic anxiety for IITD students by turning fragmented, multi-platform course materials into a single, effortless "Do This Next" feed.
>
> **Audience (rollout plan)**:
> - Week 1 → You + 2–3 close friends across groups
> - Week 2–3 → Full batch (~50–60 people, same semester)
> - Future → Generic enough for juniors / other batches

---

## ✅ V1 — Ship Today
> Core pipeline. From zero to a live, auto-updating dashboard.

### 🖥️ Dashboard (Next.js — Vercel)
- [ ] **"New This Week" feed** — files/slides uploaded in the last 7 days, newest first
  - Pulsing `NEW` badge on items < 24h old
  - Grouped by course
- [ ] **"Due Soon" deadlines panel** — sorted by urgency
  - 🔴 Red → due in < 24 hours
  - 🟡 Amber → due in < 72 hours
  - 🟢 Green → due in > 72 hours
  - Shows course name, assignment title, exact date + time
- [ ] **Lab Schedule card** — group-isolated view
  - First-visit modal: "Select your lab group (1–4)"
  - Saved to `localStorage` — no account needed
  - Shows only your group's lab sessions for the week
- [ ] **"Last synced X minutes ago"** badge — so you know data freshness
- [ ] **Dark mode by default** — easy on the eyes during late-night study sessions
- [ ] **Course filter toggles** — hide courses you don't care about right now

### ⚙️ Scraper (Python + Playwright)
- [ ] Session-cookie based login (your cookie, stored as GitHub secret)
- [ ] Scrape `moodle.iitd.ac.in` — new files, assignment deadlines
- [ ] Scrape `moodlenew.iitd.ac.in` — new files, assignment deadlines
- [ ] Graceful degradation — if one Moodle is down, skip it and continue
- [ ] Normalize both sources into a single `data.json` schema

### 🤖 Automation (GitHub Actions)
- [ ] Cron job every 3 hours (`0 */3 * * *`)
- [ ] Auto-commit updated `data.json` to repo
- [ ] Frontend fetches `data.json` client-side on each page load — no redeploy needed

---

## 🔜 V2 — This Week
> Smarter alerting. Make the dashboard feel alive.

### 📬 WhatsApp Push Alerts (New Slide Dropped)
> Since your batch lives on WhatsApp, this is higher priority than a web notification.

- [ ] Detect new uploads by diffing current vs previous `data.json`
- [ ] Send a WhatsApp message when a new file is detected
- [ ] Message format:
  ```
  📚 [COL216] New upload: "Lecture 12 - Pipelining.pdf"
  Uploaded just now → <link>
  ```
- [ ] Options to explore (cheapest first):
  - **green-api.com** — free tier, no Meta business verification needed
  - **whapi.cloud** — free sandbox
  - **Twilio WhatsApp sandbox** — free for testing
- [ ] Only alert on genuinely new items (dedup by file name + upload timestamp)

### 📊 Weekly Study Load Heatmap
> Visual calendar showing deadline density per week — spot crunch weeks before they hit.

- [ ] GitHub-contributions-style strip showing deadline count per week
- [ ] Color intensity = number of deadlines (light = chill, dark = danger zone)
- [ ] Hover/tap a week to expand all deadlines inside it
- [ ] "This week vs next week" delta badge (e.g., "+3 more deadlines next week ⚠️")

### 🔔 Browser Push Notifications
- [ ] Service Worker + Notification API — triggers on next dashboard visit after new item appears
- [ ] "A new file was uploaded to COL216" style alerts
- [ ] No server needed — pure client-side

---

## 🗓️ V3 — Month 1
> Quality-of-life features that make the semester genuinely less stressful.

### 🤖 AI Policy Assistant (RAG-Grounded)
- [ ] Ingest course syllabi PDFs into a vector store (Supabase pgvector — free tier)
- [ ] Use **Gemini 1.5 Flash API** (free tier) as the LLM
- [ ] Strict guardrail: only answers from official course documents
- [ ] If answer not found → "This isn't in the official course materials. Check with your TA."
- [ ] Example questions it can answer:
  - "What's the attendance policy for COL216?"
  - "Can I submit Assignment 3 late?"
  - "What's the weightage of the midsem?"

### 📅 Smart Exam Calendar
- [ ] Add midsem/endsem dates to the deadline heatmap (manual input or ERP scrape)
- [ ] "Days until midsem" countdown banner in the top bar
- [ ] Week-before-exam mode: surface only the most urgent items, grey out the rest

### 🗂️ PYQ (Past Year Questions) Quick Links
- [ ] Static JSON file mapping each course → curated PYQ links (Drive folders, prof-shared links)
- [ ] Shown as a collapsible "Resources" drawer per course card
- [ ] Zero scraping — pure manual curation, massively useful come exam season

### 📝 Quick Notes Per Course
- [ ] Inline sticky-note field per course (saved to `localStorage`)
- [ ] "Things to re-read before midsem" style annotations
- [ ] Private to each user's browser — no backend

### 👥 Batch-Wide Announcements Layer
- [ ] A pinned "Important" section at the top for batch-wide notices
- [ ] E.g., "Tutorial on Friday is cancelled — Prof. XYZ"
- [ ] Friends can flag items as important (simple JSON entry in repo, auto-deployed)

---

## 🚀 V4 — Long-Term / Generic Scale
> If this works for your batch, make it reusable for juniors and future batches.

### 🎓 Course Configurator (Any IITD Student)
- [ ] Replace hardcoded course list with a one-time setup form
- [ ] Student enters their Moodle course URLs + group → saved config
- [ ] Scraper reads the config dynamically

### 📱 Progressive Web App (PWA)
- [ ] "Add to Home Screen" on Android/iOS — native app feel
- [ ] Offline mode — cache last `data.json` so dashboard loads without internet
- [ ] Full PWA manifest with app icon and splash screen

### 🔗 ERP Integration
- [ ] Scrape attendance from IITD ERP
- [ ] Show attendance % per course with danger-zone warnings (< 75%)
- [ ] "You can miss X more classes before it's a problem" calculator

### 📊 Semester Analytics
- [ ] Files uploaded per week, deadline completion patterns
- [ ] End-of-sem shareable "my semester in numbers" card

---

## 💡 Parking Lot — Ideas to Revisit
> Not scoped yet. Worth keeping track of.

| Idea | Why It's Interesting |
|---|---|
| Tutorial / TA session schedule | Tutorial slots shift — useful alongside lab schedule |
| Prof office hours tracker | Manual JSON, shown in a "Help" drawer |
| Batch WhatsApp poll bot | "Raise hand if you've started Assign 3" — anonymous check-in |
| Course group links directory | One place to find the right WhatsApp/Discord group |
| File name search | Find that one lecture slide across all courses instantly |
| Color theme per course | Visual differentiation when scanning the feed |
| Pomodoro timer with course context | "Study COL216 for 25 min" — pre-loaded |

---

## 🏗️ Technical Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Frontend framework | Next.js | Rich interactivity, free Vercel deploy |
| Styling | Vanilla CSS + CSS variables | Full control, zero build overhead |
| Authentication | None (no login for friends) | Zero friction, zero liability |
| Scraper | Python + Playwright | Best for JS-heavy Moodle pages |
| Auth method | Session cookie (yours only) | Zero credential sharing |
| Data storage | `data.json` committed to repo | Simplest path, zero cost |
| Cron runner | GitHub Actions | Free: 2000 min/month — plenty |
| AI engine (Phase 3) | Gemini 1.5 Flash | Free tier, no credit card needed |
| WhatsApp alerts | TBD — green-api / Twilio | To be decided in V2 |
| Hosting | Vercel (free tier) | Auto-deploy on every commit |

---

## 📌 Guiding Principles (Never Violate These)

1. **Zero friction for friends** — no sign-ups, no passwords, no installs
2. **Zero credential sharing** — only your session cookie, stored as a GitHub secret
3. **10-second scannability** — the dashboard must convey everything in one glance
4. **Free forever** — every architectural choice must have a ₹0 path
5. **Graceful degradation** — if scraping fails, show last-known data, never crash

---

*Last updated: August 2026 | Sem just started — perfect timing to build this right.*
