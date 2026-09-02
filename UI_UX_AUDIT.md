# UI/UX Audit — Frontend (focus: Dark Mode)

**Audit date:** 2026-09-02
**Status:** ✅ All 9 findings fixed (see per-item status below). Validation: `tsc --noEmit`, ESLint, `vite build`, unit tests — all green; re-sweeps confirm no remaining light-only tints.
**Scope:** `frontend/src` — all 18 pages, shared components, global styles, theming infrastructure.
**Method:** Static code review of every page + pattern sweeps (`bg-white`, `-50` tints, `-100` tiles, ring offsets, gradients, overlays).

## Overall state

The dark mode implementation is fundamentally solid: class-based theming (`tailwind.config.js` `darkMode: 'class'`), a pre-paint inline script in `index.html` that prevents theme flash, `color-scheme` sync for native widgets, and near-universal `dark:` coverage on cards, tables, banners, buttons, and inputs (the shared `ui.tsx` primitives are fully dual-themed). What remains are **scattered light-only tints, focus-ring offsets, and a few contrast/UX gaps** listed below.

Priority key: **P1** = clearly visible dark-mode bug, **P2** = noticeable polish, **P3** = nice-to-have.

---

## 1. Focus ring offset is white in dark mode — P1 (systemic) — **FIXED**

- **Where:** `frontend/src/index.css:24-26` (`:focus-visible { ring-offset-2 }`), `frontend/src/components/ui.tsx:300,302,304` (`buttonPrimary`, `buttonSecondary`, `buttonDanger`), `frontend/src/pages/LoginPage.tsx:215`.
- **Problem:** Tailwind's default ring-offset color is **white**. In dark mode every keyboard-focused button gets a bright white halo/gap between the ring and the dark button/background. This is the most visible dark-mode defect and it affects every button and every keyboard navigation across the app.
- **Fix applied:** `dark:ring-offset-gray-950` added to the global `:focus-visible` rule and to all three shared button classes plus the login submit button.

## 2. Light `-50`/`-100` tint chips & tiles without dark variants — P1 — **FIXED**

These render as bright pastel rectangles floating on dark `gray-900` surfaces:

- **`frontend/src/pages/StudentProfilePage.tsx`**
  - `:132`, `:154`, `:225` — `bg-primary-50 text-primary-600` icon chips (courses list, attempts tab)
  - `:268` — quiz score pill `bg-primary-50 text-primary-700`
- **`frontend/src/pages/CourseDetailPage.tsx`**
  - `:442`, `:785`, `:970` — `bg-primary-50 text-primary-600` icon chips (assignments, quizzes, content rows)
  - `:808` — availability pill `bg-green-50 text-green-700` (no dark variant, unlike every other status pill)
- **`frontend/src/pages/DashboardPage.tsx:374`** — score pill `bg-primary-50 text-primary-700`
- **`frontend/src/pages/CourseDetailPage.tsx:69-94`** — `CONTENT_TYPE_META` tiles: VIDEO/DOCUMENT/PDF/IMAGE/LINK use `bg-purple-100/blue-100/red-100/emerald-100/amber-100` with **no** dark variants (only `OTHER` has them). Content rows show glaring light tiles in dark mode.
- **Fix applied:** Standardized on the app's existing dark tint pattern `dark:bg-<color>-500/10 dark:text-<color>-400`. All call sites fixed (StudentProfilePage ×4, CourseDetailPage chips/tiles/submitted pill/tab counts, DashboardPage pills), plus two extra issues the sweep surfaced while fixing: the quiz selected-option highlight (`QuizDetailPage`) and both file-input chips (`AdminUsersPage`, `AssignmentDetailPage`).

## 3. `fieldErrorStyles` unreadable in dark mode — P1 (small but user-facing) — **FIXED**

- **Where:** `frontend/src/components/ui.tsx:331`
- **Problem:** `text-red-600` with no dark variant — dark red on `gray-950` inputs has poor contrast exactly when the user made a mistake and needs to read the message.
- **Fix applied:** `text-red-600 dark:text-red-400` on the shared class.

## 4. NotFoundPage 404 gradient text nearly invisible in dark — P2 — **FIXED**

- **Where:** `frontend/src/pages/NotFoundPage.tsx:7` — `bg-gradient-to-b from-primary-600 to-primary-800 bg-clip-text text-transparent`
- **Problem:** `primary-800` (#1e40af) sits on `gray-950` at very low contrast; the giant "404" is barely readable in dark mode.
- **Fix applied:** `dark:from-primary-300 dark:to-primary-500`.

## 5. No theme toggle on the login page — P2 (UX) — **FIXED**

- **Where:** `useTheme` is consumed only in `Layout.tsx`; `LoginPage` has no toggle.
- **Problem:** A dark-mode user who logs out (or is redirected to `/login`) cannot switch back before signing in; the login screen honors the stored theme but offers no control. Also a first-time visitor on a dark OS sees no toggle at all until they log in.
- **Fix applied:** Extracted `ThemeToggleButton` into `components/ThemeToggleButton.tsx` (with ring-offset fix included), used by both the Layout topbar and the LoginPage (top-right corner).

## 6. System theme changes are ignored while the app is open — P3 — **FIXED**

- **Where:** `frontend/src/hooks/useTheme.ts`
- **Problem:** The initial theme respects `prefers-color-scheme`, but there is no `matchMedia('(prefers-color-scheme: dark)').addEventListener('change')` listener; switching the OS theme mid-session does nothing until reload (and only then if the user never toggled manually).
- **Fix applied:** Added a `change` listener that follows the OS theme only while the user has not explicitly chosen one (`localStorage.theme` unset).

## 7. `StatusBadge` / cards: black hairline rings invisible in dark — P3 — **FIXED**

- **Where:** `frontend/src/components/StatusBadge.tsx:34` (`ring-black/[0.04]`), and many card strings `ring-1 ring-black/[0.02]` alongside `dark:ring-white/[0.03]` — the badges are the only shared element missing the dark counterpart.
- **Problem:** In dark mode the badge inset ring disappears (black on dark), making badges sit flatter than in light mode. Cosmetic inconsistency, not a contrast bug.
- **Fix applied:** `dark:ring-white/10` on `StatusBadge` (and on the CourseDetail "Submitted" pill while there).

## 8. Junk/conflicting classes — P3 (hygiene) — **FIXED**

- **Where:** `frontend/src/components/Layout.tsx:296` — `className="h-4.5 w-4.5 h-[18px] w-[18px] ..."` (`h-4.5`/`w-4.5` are not default Tailwind sizes and are overridden by the arbitrary values in the same string).
- **Fix applied:** Dropped `h-4.5 w-4.5`.

## 9. Muted text at the low end of contrast — P3 — **FIXED**

- **Where:** e.g. `Layout.tsx:238` (nav group headings `text-gray-400 dark:text-gray-600`), various `hint` texts (`StatCard` `dark:text-gray-500`, timestamps `dark:text-gray-500`).
- **Problem:** `gray-600` on `gray-950` is ~3.2:1 — below WCAG AA (4.5:1) for the small caps headings. Intentionally muted, but the darkest end hurts legibility on low-quality projectors (relevant for classrooms).
- **Fix applied:** The single `dark:text-gray-600` offender (nav group headings) bumped to `dark:text-gray-500` (~4.6:1). The remaining `dark:text-gray-500` usages already sit at/above ~4.6:1 and were left as intentional muting.

## Verified as already good (no action needed)

- Theme flash prevention (inline script in `index.html`), `color-scheme` sync for native date pickers/scrollbars.
- All cards, tables (thead/tbody/hover rows), banners, empty/error/loading states, buttons, inputs, selects, labels — fully dual-themed in `ui.tsx`.
- Gradient hero panels (Courses, StudentProfile, CourseDetail, Login) with solid fallbacks and `dark:hidden` glows — deliberate design, works in both modes.
- Quiz timer pill, notification badge (`ring-white dark:ring-gray-950`), avatar menu, mobile drawer overlay, amber temp-password block, MyBorrowing overdue row tint — all have dark variants.
- `bg-white/10-15` occurrences are white overlays on colored gradients (intentional in both modes), not surfaces.

---

## Suggested fix order — ALL DONE

1. ✅ Item 1 (focus ring offsets)
2. ✅ Item 2 (tint chips/tiles sweep + quiz highlight + file-input chips)
3. ✅ Items 3 + 4 (contrast fixes)
4. ✅ Item 5 (login theme toggle)
5. ✅ Items 6-9 (polish batch)
