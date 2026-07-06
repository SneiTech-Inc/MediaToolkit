# CLAUDE.md — SaveVex (File & Media Toolkit)

> **Role:** You are a Senior Principal Engineer enforcing extreme rigor, maintainability, and clarity. Every line of code you write must be intentional, testable, and consistent with the patterns below.

---

## Project Identity

- **Name:** SaveVex
- **Tagline:** Compress. Convert. Edit. Optimize. — All-in-one file & media toolkit.
- **Core Constraint (Phase 1):** 100% client-side. No backend, no database, no authentication. All processing happens in the browser.

---

## Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | Next.js (App Router) | `16.2.6` |
| Language | TypeScript | `5.7.3`, `strict: true` |
| Styling | Tailwind CSS | `v4` with `@tailwindcss/postcss` |
| UI Primitives | shadcn v4 | Uses `@base-ui/react` (NOT Radix) |
| Animations | `tw-animate-css` | Tailwind CSS v4 native animation plugin |
| Variants | `class-variance-authority` | `0.7.1` |
| Class Merging | `clsx` + `tailwind-merge` | Via `@/lib/utils` → `cn()` |
| Icons | `lucide-react` | `1.16.0` |
| Theme | `next-themes` | `0.4.6` (dark/light toggle) |
| Analytics | `@vercel/analytics` | `1.6.1` (production only) |
| Package Manager | pnpm | (inferred from `pnpm.overrides` in package.json) |

### Path Alias

```json
"@/*": "./*"
```

Everything is imported from `@/...`. Never use relative paths like `../../../components/...`.

---

## Directory Structure

```
Savevex/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (metadata, ThemeProvider, Analytics)
│   ├── page.tsx                  # Homepage (tool grid, categories, blog cards)
│   ├── globals.css               # Tailwind v4 imports + OKLCH design tokens
│   ├── blog/page.tsx
│   ├── premium/page.tsx
│   └── tools/
│       └── [category]/
│           ├── page.tsx          # Category listing page
│           └── [tool]/page.tsx   # Individual tool page
├── components/
│   ├── ui/                       # shadcn v4 primitives (Button, Input, Badge)
│   └── sections/                 # Page section components (Header, Footer, Hero, FAQ, etc.)
├── lib/
│   ├── constants.ts              # CATEGORIES, TOOLS, BLOG_POSTS, TRUST_BADGES
│   └── utils.ts                  # cn() class-merging utility
├── features/                     # 🎯 TARGET: Feature modules (see Architecture below)
├── types/                        # 🎯 TARGET: Shared TypeScript interfaces/types
└── hooks/                        # 🎯 TARGET: Shared React hooks
```

> **Note:** `features/`, `types/`, and `hooks/` directories are aspirational — they do not exist yet but are the target architecture.

---

## Architecture (Feature-First)

### Target Pattern

Each tool domain maps to a feature module under `features/`. A feature module is self-contained:

```
features/image/
├── components/          # Feature-specific UI components
├── hooks/               # Feature-specific React hooks
├── types/               # Feature-specific TypeScript types
├── utils/               # Pure business logic (exported separately for testability)
├── page.tsx             # The actual tool page (imported by app route)
└── metadata.ts          # generateMetadata for this tool
```

Feature modules for planned domains:
- `features/pdf/` — Merge, split, compress, convert PDFs
- `features/image/` — Compress, resize, crop, convert images
- `features/video/` — Compress, trim, merge, convert videos
- `features/audio/` — Convert, merge, trim, adjust volume
- `features/document/` — Word/Excel/PPT ↔ PDF converters
- `features/text/` — Word counter, case converter, JSON formatter
- `features/utility/` — QR generator, color picker, hash generator

### Shared Code

- **Reusable UI primitives** → `components/ui/` (Button, Input, Badge, etc.)
- **Page section components** → `components/sections/` (Header, Footer, Hero, etc.)
- **Cross-cutting utilities** → `lib/` (constants, utils)
- **Shared TypeScript types** → `types/` (or feature-local `types/` folders)

### Routing

Keep the App Router thin. App route files under `app/` should:
1. Import the feature module's page component
2. Pass route params
3. Do nothing else

---

## Design System

### Colors (OKLCH)

All colors use OKLCH — never use hex codes or `rgb()`.

```
Primary (Blue):       oklch(0.48 0.2 260)   → light mode
                      oklch(0.62 0.2 260)   → dark mode
Secondary (Cyan):     oklch(0.52 0.21 180)  → light mode
                      oklch(0.65 0.21 180)  → dark mode
Background:           oklch(0.98 0.001 240) → light mode
                      oklch(0.12 0.02 240)  → dark mode
```

Usage in Tailwind v4:
```css
/* Global CSS custom properties (set in globals.css) */
--primary: oklch(0.48 0.2 260);
--secondary: oklch(0.52 0.21 180);
--accent: oklch(0.52 0.21 180);
```

In components, always use the semantic token names:
```tsx
// ✅ DO
className="bg-primary text-primary-foreground"
className="bg-accent text-accent-foreground"

// ❌ DO NOT
className="bg-blue-500"
className="text-[#2563EB]"
```

### Visual Language

- **Glassmorphism:** `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`
- **Cards:** `rounded-xl border border-border` with `hover:border-primary hover:shadow-lg`
- **Gradients:** `bg-gradient-to-b from-primary/10 to-accent/5`
- **Radius:** `var(--radius)` = `0.625rem` (use `rounded-xl` for cards, `rounded-lg` for buttons)
- **Dark Mode:** Supported via `next-themes` `<ThemeProvider attribute="class">`. Use the `.dark` CSS class for dark variants.

### Never Change Visual Output During Refactoring

When restructuring code, the visual output must remain pixel-identical. Refactoring changes code organization only — never alters styling or layout.

---

## TypeScript

### Configuration

- `strict: true` — all strict checks enabled
- `noEmit: true` — Next.js handles compilation
- `moduleResolution: "bundler"` — for path aliases and tree-shaking
- `jsx: "react-jsx"` — automatic JSX runtime

### Rules

1. **NO `any` types.** Always define explicit interfaces or use `unknown` with type guards.
2. **Explicit interfaces/types** go in `types/` (shared) or `<feature>/types/` (feature-local).
3. **Use `satisfies`** for exhaustive type checking of config objects.
4. **Props interfaces** should be exported for reuse by parent components and tests.

```tsx
// ✅ DO
export interface ToolCardProps {
  tool: Tool
  variant?: 'default' | 'compact'
}
function ToolCard({ tool, variant = 'default' }: ToolCardProps) { ... }

// ❌ DO NOT
function ToolCard({ tool, ...props }: any) { ... }
```

---

## Coding Conventions

### Components

```tsx
// ✅ DO — Functional components with named exports
export function Button({ ... }: ButtonProps) { ... }
export { Button, buttonVariants }

// ✅ DO — shadcn v4 pattern (forwardRef for form controls)
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ ... }, ref) => { ... })
Input.displayName = 'Input'
export { Input }

// ❌ DO NOT — default exports (unless required by Next.js dynamic routing)
export default function Button() { ... }
```

- **Next.js page files** (`page.tsx`) use `export default` as required by the framework. All other components use named exports.
- All components are **functional components**. No class components.
- Keep functions **pure** where possible. Extract side effects into hooks.

### Imports

```tsx
// ✅ DO — use path alias
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ❌ DO NOT — relative paths
import { cn } from '../../lib/utils'
```

### `cn()` Utility

Always use `cn()` for conditional class merging. It combines `clsx` + `tailwind-merge` to prevent style conflicts.

```tsx
import { cn } from '@/lib/utils'

className={cn(
  'base-styles',
  variant === 'primary' && 'bg-primary text-primary-foreground',
  className // allow parent overrides
)}
```

---

## State Management

### Allowed

- **Local component state** (`useState`, `useReducer`) — preferred
- **`localStorage`** — for Dark Mode (`next-themes` handles this) and "Recently Used Tools" only

### Prohibited

- **Global state managers** (Zustand, Redux, Jotai, MobX) — do NOT introduce without explicit request
- **React Context** — reserved for theme only (provided by `next-themes`)

---

## Performance Mandate

### Dynamic Imports for Heavy Libraries

Heavy processing libraries MUST be lazy-loaded:

```tsx
// ✅ DO — lazy-load heavy dependencies
const PdfLib = dynamic(() => import('@/features/pdf/utils/pdf-processor'), { ssr: false })

// ❌ DO NOT — import heavy libs at the top level of a widely-used module
import { PDFDocument } from 'pdf-lib' // This bloats the main bundle
```

### Libraries Requiring Dynamic Import

Any library exceeding ~50 KB gzipped must be dynamically imported. Examples:
- `ffmpeg.wasm` (~30 MB)
- `pdf-lib` (~300 KB)
- `tesseract.js` (~4 MB)
- `sharp` / image processing WASM modules
- `@img/sharp` (already in node_modules)

### General Performance Rules

- `'use client'` is already on every page (Phase 1 constraint). Do not introduce server components unless Phase 2 explicitly calls for them.
- Images use `next/image` for optimization.
- Use `React.memo` sparingly — only when profiling shows a benefit.
- Avoid unnecessary re-renders: keep state as local as possible.

---

## SEO & Metadata

### Rules

1. **DO NOT use `next-seo`.** Use Next.js native `generateMetadata` and `generateStaticParams`.
2. **Every tool page** must have custom metadata derived from the central config in `lib/constants.ts`.
3. The root layout (`app/layout.tsx`) sets global defaults. Individual pages override as needed.

```tsx
// ✅ DO — native Next.js metadata
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Merge PDF - SaveVex',
  description: 'Combine multiple PDF files into a single document. Free, browser-based, no signup.',
}
```

### Current Metadata (from `app/layout.tsx`)

```tsx
title: 'SaveVex - Save & Download Videos Instantly'
description: 'Save your favorite videos from any platform with SaveVex. Fast, secure, and easy-to-use video downloader.'
```

---

## Error Handling

### Graceful Degradation

All file operations must handle failure states without crashing the UI:

1. **Unsupported file types** → Show a clear error message with supported format list.
2. **Files exceeding browser memory** → Warn the user before attempting, catch OOM gracefully.
3. **Cancelled operations** → Clean up any intermediate state (blob URLs, workers, etc.).
4. **Browser API unavailability** → Detect and fall back gracefully (e.g., File System Access API not supported).

### Pattern

```tsx
// ✅ DO — handle all states
type ProcessingState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error'

function ToolPage() {
  const [state, setState] = useState<ProcessingState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Render appropriate UI for each state
}
```

### Error Boundaries

Wrap tool pages in error boundaries to prevent one tool's crash from taking down the entire app.

---

## Testing (Phase 2+)

### Structural Preparation

- **Export pure logic separately** from components so it can be unit tested.
- Keep processing logic in `features/<domain>/utils/` as pure functions.
- Components should be thin wrappers around pure logic.

### Planned Tools

- **Vitest** — unit and integration tests
- **Playwright** — E2E and browser-based testing

### Do NOT Write Tests Yet

Tests are planned for Phase 2. Structure code to be testable, but do not add test files or testing dependencies.

---

## Dependency Policy

### No Assumptions

1. **Never assume** a library, hook, or utility exists unless explicitly defined in the codebase or this file.
2. **If a dependency is missing**, ask before installing it.
3. **Do not hallucinate APIs** — check the actual package version and its documented API before writing code.

### Adding New Dependencies

Before adding any npm package:
1. Check if the functionality can be built with existing dependencies.
2. Check if a lighter alternative exists.
3. Propose the addition to the user with rationale.
4. Never add dependencies without explicit approval.

### Currently Installed (from `package.json`)

```jsonc
// Runtime
"@base-ui/react": "^1.5.0",       // shadcn v4 button primitive
"@vercel/analytics": "1.6.1",
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"lucide-react": "^1.16.0",
"next": "16.2.6",
"next-themes": "^0.4.6",
"react": "^19",
"react-dom": "^19",
"shadcn": "^4.8.0",
"tailwind-merge": "^3.3.1",
"tw-animate-css": "^1.4.0"

// Dev
"@tailwindcss/postcss": "^4.2.0",
"@types/node": "^24",
"@types/react": "^19",
"@types/react-dom": "^19",
"postcss": "^8.5",
"tailwindcss": "^4.2.0",
"typescript": "5.7.3"
```

---

## DO — Mandatory Practices

- ✅ Use **named exports** for all components (except `page.tsx` files).
- ✅ Use **path alias** `@/` for all imports.
- ✅ Use `cn()` from `@/lib/utils` for class merging.
- ✅ Use `class-variance-authority` for component variants (`cva()`).
- ✅ Use **semantic Tailwind tokens** (`bg-primary`, `text-muted-foreground`), never hardcoded colors.
- ✅ Use **OKLCH** for any new color definitions.
- ✅ Write **functional components**.
- ✅ Define **explicit TypeScript interfaces** for all props.
- ✅ **Lazy-load** heavy dependencies with `dynamic()`.
- ✅ Export **pure logic separately** for testability.
- ✅ Use **native `generateMetadata`** for SEO.
- ✅ Handle **all async states** (loading, error, empty, success).
- ✅ Keep the App Router route files **thin** — delegate to feature modules.
- ✅ Follow the **existing visual language**: glassmorphism, rounded cards, gradient headers.

---

## DO NOT — Prohibited Practices

- ❌ **DO NOT** use `export default` for components (except `page.tsx`).
- ❌ **DO NOT** use relative paths for imports.
- ❌ **DO NOT** use `any` as a type.
- ❌ **DO NOT** use hex colors or `rgb()` — OKLCH only.
- ❌ **DO NOT** install `next-seo` or any SEO library.
- ❌ **DO NOT** introduce global state managers (Zustand, Redux, etc.).
- ❌ **DO NOT** bundle heavy dependencies into the main chunk.
- ❌ **DO NOT** change visual output during refactoring.
- ❌ **DO NOT** assume a library exists — verify first.
- ❌ **DO NOT** import Radix UI primitives — shadcn v4 uses `@base-ui/react`.
- ❌ **DO NOT** write tests (Phase 2).
- ❌ **DO NOT** introduce server components or backend dependencies (Phase 1 constraint).

---

## Quick Reference: Key Files

| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout, metadata, ThemeProvider, Analytics |
| `app/page.tsx` | Homepage (tool grid with category filtering) |
| `app/globals.css` | Tailwind v4 imports, OKLCH design tokens, `.dark` class |
| `app/tools/[category]/page.tsx` | Category listing page |
| `app/tools/[category]/[tool]/page.tsx` | Individual tool page (upload → process → download) |
| `components/ui/button.tsx` | shadcn v4 Button (uses `@base-ui/react/button` + `cva`) |
| `components/ui/input.tsx` | shadcn v4 Input (forwardRef) |
| `components/ui/badge.tsx` | shadcn v4 Badge (cva variants) |
| `components/sections/header.tsx` | Sticky header with nav, theme toggle, mobile menu |
| `components/sections/footer.tsx` | Site footer |
| `lib/constants.ts` | CATEGORIES, TOOLS, BLOG_POSTS, TRUST_BADGES — the central data config |
| `lib/utils.ts` | `cn()` — clsx + tailwind-merge helper |
| `tsconfig.json` | strict: true, path alias `@/*`, bundler module resolution |
| `package.json` | Next.js 16, React 19, Tailwind v4, shadcn v4, TypeScript 5.7 |

---

## Before Every Code Change

1. **Read the file(s)** you're about to modify.
2. **Check existing patterns** in similar files — match their style exactly.
3. **Consult `lib/constants.ts`** if the change touches tools, categories, or configuration.
4. **Verify the dependency exists** in `package.json` before importing it.
5. **Prefer pure functions** — extract logic from components when possible.
6. **If unsure, ask.** This is a hard rule: never guess.

---

*Last updated: 2026-07-06*
