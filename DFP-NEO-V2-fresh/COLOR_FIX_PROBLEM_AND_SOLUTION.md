# 📌 PINNED: FIC211 Course Color Fix — Problem & Solution Record

**Date:** April 2026  
**Branch:** `feature/comprehensive-build-algorithm`  
**Commit range:** `ce0ee32c` → `da01a0a8`

---

## 🔴 THE PROBLEM

### Root Cause #1: Railway always serves the committed bundle

The Railway Dockerfile has two stages:
- **Stage 13:** `RUN npm run build` — Railway builds the app
- **Stage 15:** `COPY . /app` — **Overwrites** the Railway-built files with your committed files from git

This means **Railway always serves the `index.js` that is committed to the repo**, not what it just built.

The committed `index.js` in commit `ce0ee32c` was actually built from a **future version** of the source code (one that already had hex color fixes inline). When we rebuilt locally from `ce0ee32c`'s source, we got a different bundle with a different initialization order — causing `instructorsData.length = 0` (no staff, no trainees, no courses showing).

**Rule:** Never rebuild `index.js`. Only apply surgical string replacements to the committed bundle.

---

### Root Cause #2: Hex color string used as CSS className

FIC211's course color was stored in the database as `#F97316` (a hex string). But every UI component used the color value directly as a **Tailwind CSS className**, e.g.:

```jsx
<div className={`... ${color} ...`}>  // ❌ breaks when color = "#F97316"
```

Tailwind only knows class names like `bg-orange-500`. A hex value like `#F97316` as a className does nothing — the div gets no background color.

**Fix:** Check `color.startsWith("#")` and switch to inline `style={{ backgroundColor: color }}` when hex.

---

### Root Cause #3: Orange too bright

`#F97316` is Tailwind `orange-500` — very vivid/bright compared to the other muted course colors (which use `/50` opacity variants). Dulled to `#D4722A` (earthier, lower saturation).

---

## ✅ THE SOLUTION: Surgical Bundle Patches

All fixes are applied via **direct string replacements** in:  
`dfp-neo-platform/public/flight-school-app/assets/index.js`

The script `patch_bundle.py` documents and can re-apply all patches.

### Session 1 Patches (hex display in UI components):

| Patch | Location | Fix |
|-------|----------|-----|
| 1 | Sidebar legend dot | hex → `style.backgroundColor` |
| 2 | CourseRosterView card header | hex → `style.backgroundColor` |
| 3 | CourseDataWindow header | hex → `style.backgroundColor` |
| 4 | CourseDataWindow progress bars | hex → `style.backgroundColor` |
| 5 | ArchivedCoursesView color swatch | hex → `style.backgroundColor` |

### Session 2 Patches (FlightTile/FTD tiles + orange dulling):

| Patch | Location | Fix |
|-------|----------|-----|
| A | FlightTile `backgroundClass` | hex-aware: don't use as className |
| B | FlightTile `isPreview` branch | hex-aware: don't push hex as className |
| C | FlightTile main div `style` | merge `backgroundColor` when hex |
| D | `courseColors[c.name] = c.color` | normalize `#F97316` → `#D4722A` |
| E | DB load path 1 (dbCourses.map) | normalize `#F97316` → `#D4722A` |
| F | DB load path 2 (setCourseColors) | normalize `#F97316` → `#D4722A` |
| G | `dbArchivedCourses` reduce | normalize `#F97316` → `#D4722A` |
| H | Demo dataset (Object.fromEntries) | normalize `#F97316` → `#D4722A` |
| I | `handleAddCourseFromTrainingRecords` | normalize `#F97316` → `#D4722A` |

---

## 🔧 How to Re-Apply Patches (if bundle is ever reset)

```bash
cd DFP-NEO-V2-fresh
python3 patch_bundle.py
git add dfp-neo-platform/public/flight-school-app/assets/index.js
git commit -m "Re-apply color patches"
git push
```

---

## ⚠️ CRITICAL RULES

1. **NEVER run `npm run build`** — it will replace the working bundle with a broken one
2. **NEVER change `vite.config.ts`** in a way that triggers a rebuild on Railway  
3. If a future dev needs to add source-level fixes, they must:
   a. Fix the source files (`.tsx`)
   b. Build locally and verify the app works (no missing staff/trainees)
   c. Commit BOTH the source AND the new `index.js`
   d. Update `patch_bundle.py` with any new patches

---

## 📊 Color Reference

| Color | Value | Where used |
|-------|-------|-----------|
| Old orange (too bright) | `#F97316` | Was in DB for FIC211 |
| New orange (dulled) | `#D4722A` | Applied via normalization patches |
| Other courses | Tailwind classes (`bg-teal-400/50`, `bg-blue-500/50`, etc.) | Work natively |