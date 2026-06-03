# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React PWA, wire up Supabase auth (email/password + magic link + Google), and ship an installable app shell with bottom-nav and empty screens.

**Architecture:** Vite + React + TypeScript + Tailwind PWA. Supabase for auth + Postgres. App-level `AuthProvider` exposes session via a hook; a `ProtectedRoute` redirects unauthenticated users to `SignIn`. Once signed in, an `AppShell` renders the active tab with a fixed bottom nav.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, vite-plugin-pwa, Supabase JS, React Router, Vitest + React Testing Library.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (end state of this plan)

```
racquetball-app/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.local                    # not committed
├── .env.example                  # committed
├── .gitignore
├── public/
│   ├── icon-192.png
│   └── icon-512.png
├── supabase/
│   └── migrations/
│       └── 0001_profiles.sql
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   └── supabase.ts
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   ├── ProtectedRoute.tsx
│   │   └── SignIn.tsx
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   └── BottomNav.tsx
│   └── screens/
│       ├── Home.tsx
│       ├── Log.tsx
│       ├── Stats.tsx
│       └── More.tsx
└── tests/
    ├── setup.ts
    ├── AuthProvider.test.tsx
    ├── SignIn.test.tsx
    └── BottomNav.test.tsx
```

---

### Task 1: Initialize git repo and Vite project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`

- [ ] **Step 1: Init git in the project directory**

```bash
cd "C:/Users/jim.h/OneDrive - Pine Pharmaceuticals/Desktop/racquetball-app"
git init -b main
```

- [ ] **Step 2: Scaffold Vite + React + TypeScript**

```bash
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty…" choose **Ignore files and continue**.

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

- [ ] **Step 4: Verify dev server runs**

```bash
npm run dev
```

Expected: Server starts at http://localhost:5173 showing the default Vite + React page. Stop with Ctrl+C.

- [ ] **Step 5: Replace .gitignore with a Node-friendly version**

Overwrite `.gitignore` with:

```gitignore
node_modules
dist
dist-ssr
*.local
.env.local
.env.*.local
.vite
.DS_Store
*.log
coverage
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Install and configure Tailwind CSS

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Modify: `src/index.css`, `src/App.tsx`

- [ ] **Step 1: Install Tailwind**

```bash
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure content paths**

Overwrite `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 3: Replace index.css with Tailwind directives**

Overwrite `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-slate-50 text-slate-900 antialiased; }
```

- [ ] **Step 4: Smoke-test Tailwind**

Overwrite `src/App.tsx` with:

```tsx
export default function App() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <h1 className="text-3xl font-bold text-emerald-600">Racquetball</h1>
    </div>
  )
}
```

Run `npm run dev`, open http://localhost:5173. Expected: large green "Racquetball" heading, centered, on a light-grey page. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Tailwind CSS"
```

---

### Task 3: Configure as a PWA

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png` (placeholders for now)

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Configure the PWA plugin**

Overwrite `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Racquetball League',
        short_name: 'Racquetball',
        description: 'Track racquetball matches and league play',
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

- [ ] **Step 3: Create placeholder icons**

Use any 192×192 and 512×512 PNGs you have on hand, or generate them at https://favicon.io/. Save as `public/icon-192.png` and `public/icon-512.png`. Real branding can come later.

- [ ] **Step 4: Set theme color in index.html**

In `index.html`, inside `<head>`, add:

```html
<meta name="theme-color" content="#059669" />
```

- [ ] **Step 5: Verify build succeeds**

```bash
npm run build
```

Expected: build completes, `dist/manifest.webmanifest` and `dist/sw.js` are created.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: configure as installable PWA"
```

---

### Task 4: Create Supabase project and configure client

**Manual steps (you, not the engineer):**

1. Go to https://supabase.com, sign in, create a new project named "racquetball-league".
2. Wait for the project to provision (~2 min).
3. Project Settings → API → copy the **Project URL** and **anon public key**.

**Files:**
- Create: `.env.local`, `.env.example`, `src/lib/supabase.ts`

- [ ] **Step 1: Install Supabase JS**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create .env.local with your Supabase credentials**

Create `.env.local`:

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

- [ ] **Step 3: Create .env.example (committed) with empty placeholders**

Create `.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Create the Supabase client singleton**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
```

- [ ] **Step 5: Verify env loads — temporary console.log**

Edit `src/App.tsx` to add at the top:

```tsx
import { supabase } from './lib/supabase'
console.log('Supabase client created:', !!supabase)
```

Run `npm run dev`, open http://localhost:5173, check console. Expected: `Supabase client created: true`. Remove the import + log line afterwards.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example src/lib/supabase.ts package.json package-lock.json
git commit -m "feat: add Supabase client"
```

(Note: `.env.local` is gitignored. Don't commit it.)

---

### Task 5: Create profiles table migration

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_profiles.sql`:

```sql
-- Profile extension to auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  default_text_template text default 'Hey {name}, confirming our match {when}?',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated using (auth.uid() = id);
```

- [ ] **Step 2: Apply the migration in Supabase**

In the Supabase dashboard → SQL Editor → paste the SQL above → Run.
Expected: "Success. No rows returned." Verify under Table Editor that `profiles` exists with RLS enabled.

- [ ] **Step 3: Configure Google OAuth (manual)**

In the Supabase dashboard → Authentication → Providers:
- Enable Email (already on).
- Enable Google → follow the dialog to register an OAuth app at console.cloud.google.com → paste the Client ID and Secret back into Supabase.
- Authentication → URL Configuration → Site URL: `http://localhost:5173` for now. Add Vercel URL later.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add profiles table migration"
```

---

### Task 6: AuthProvider + useAuth hook (TDD)

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `tests/AuthProvider.test.tsx`, `tests/setup.ts`, `vitest.config.ts`

- [ ] **Step 1: Install testing dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Create test setup file**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, in `scripts`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write the failing test**

Create `tests/AuthProvider.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/auth/AuthProvider'
import { useAuth } from '../src/auth/useAuth'

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        mockOnAuthStateChange(cb)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

function Probe() {
  const { session, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{session ? `signed-in:${session.user.id}` : 'signed-out'}</div>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
  })

  it('renders loading then signed-out when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await screen.findByText('signed-out')
  })

  it('renders signed-in when session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'abc' } } },
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed-in:abc')
  })

  it('updates when auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed-out')
    const cb = mockOnAuthStateChange.mock.calls[0][0]
    await act(async () => cb('SIGNED_IN', { user: { id: 'xyz' } }))
    await screen.findByText('signed-in:xyz')
  })
})
```

- [ ] **Step 6: Run the test — expect failure**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/auth/AuthProvider'`.

- [ ] **Step 7: Create the useAuth hook**

Create `src/auth/useAuth.ts`:

```ts
import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = {
  session: Session | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 8: Create the AuthProvider**

Create `src/auth/AuthProvider.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 9: Run tests — expect pass**

```bash
npm test
```

Expected: all three AuthProvider tests pass.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: AuthProvider + useAuth hook with tests"
```

---

### Task 7: SignIn screen (TDD)

**Files:**
- Create: `src/auth/SignIn.tsx`, `tests/SignIn.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/SignIn.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SignIn } from '../src/auth/SignIn'

const signInWithPassword = vi.fn()
const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}))

describe('SignIn', () => {
  beforeEach(() => {
    signInWithPassword.mockReset().mockResolvedValue({ error: null })
    signInWithOtp.mockReset().mockResolvedValue({ error: null })
    signInWithOAuth.mockReset().mockResolvedValue({ error: null })
  })

  it('signs in with email + password', async () => {
    render(<SignIn />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }))
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' })
  })

  it('sends a magic link', async () => {
    render(<SignIn />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /email me a link/i }))
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' })
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })

  it('starts Google OAuth', async () => {
    render(<SignIn />)
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' })
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/auth/SignIn'`.

- [ ] **Step 3: Implement SignIn**

Create `src/auth/SignIn.tsx`:

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  async function handleMagic() {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setMagicSent(true)
  }

  async function handleGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {magicSent && <p className="text-emerald-700 text-sm">Check your email for a sign-in link.</p>}

        <form onSubmit={handlePassword} className="space-y-3">
          <label className="block text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-emerald-600 text-white py-2 font-medium"
          >
            Sign in with password
          </button>
        </form>

        <button
          type="button"
          onClick={handleMagic}
          className="w-full rounded border border-slate-300 py-2 font-medium"
        >
          Email me a link
        </button>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded border border-slate-300 py-2 font-medium"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: SignIn tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: SignIn screen with email/password, magic link, and Google"
```

---

### Task 8: Add React Router and ProtectedRoute

**Files:**
- Create: `src/auth/ProtectedRoute.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Install React Router**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Wrap app in BrowserRouter and AuthProvider**

Overwrite `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Create ProtectedRoute**

Create `src/auth/ProtectedRoute.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6">Loading…</div>
  if (!session) return <Navigate to="/signin" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Wire routes in App.tsx**

Overwrite `src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn } from './auth/SignIn'
import { ProtectedRoute } from './auth/ProtectedRoute'

function Placeholder({ name }: { name: string }) {
  return <div className="p-6 text-xl">{name} (coming soon)</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Placeholder name="App shell placeholder" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 5: Manually verify sign-in flow**

Run `npm run dev`. Open http://localhost:5173. Expected:
- You're redirected to `/signin`.
- Create an account via the magic link (use your real email).
- After clicking the email link, you land back on `/` with "App shell placeholder (coming soon)" visible.

If Google OAuth isn't fully configured yet, that's fine — confirm email + magic link work. Stop server.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: routing + ProtectedRoute"
```

---

### Task 9: AppShell with bottom navigation (TDD)

**Files:**
- Create: `src/shell/AppShell.tsx`, `src/shell/BottomNav.tsx`, `src/screens/Home.tsx`, `src/screens/Log.tsx`, `src/screens/Stats.tsx`, `src/screens/More.tsx`, `tests/BottomNav.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the four screen placeholders**

Create `src/screens/Home.tsx`:

```tsx
export function Home() {
  return <div className="p-6 text-xl font-semibold">Home</div>
}
```

Create `src/screens/Log.tsx`:

```tsx
export function Log() {
  return <div className="p-6 text-xl font-semibold">Log Match</div>
}
```

Create `src/screens/Stats.tsx`:

```tsx
export function Stats() {
  return <div className="p-6 text-xl font-semibold">Stats</div>
}
```

Create `src/screens/More.tsx`:

```tsx
export function More() {
  return <div className="p-6 text-xl font-semibold">More</div>
}
```

- [ ] **Step 2: Write the BottomNav failing test**

Create `tests/BottomNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BottomNav } from '../src/shell/BottomNav'

describe('BottomNav', () => {
  it('renders four nav links', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log/i })).toHaveAttribute('href', '/log')
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats')
    expect(screen.getByRole('link', { name: /more/i })).toHaveAttribute('href', '/more')
  })
})
```

- [ ] **Step 3: Run test — expect failure**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/shell/BottomNav'`.

- [ ] **Step 4: Create BottomNav**

Create `src/shell/BottomNav.tsx`:

```tsx
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home' },
  { to: '/log', label: 'Log' },
  { to: '/stats', label: 'Stats' },
  { to: '/more', label: 'More' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200">
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `block text-center py-3 text-sm font-medium ${
                  isActive ? 'text-emerald-600' : 'text-slate-500'
                }`
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 5: Create AppShell**

Create `src/shell/AppShell.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Home } from '../screens/Home'
import { Log } from '../screens/Log'
import { Stats } from '../screens/Stats'
import { More } from '../screens/More'

export function AppShell() {
  return (
    <div className="min-h-full pb-16">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<Log />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6: Wire AppShell into App.tsx**

Overwrite `src/App.tsx`:

```tsx
import { Routes, Route } from 'react-router-dom'
import { SignIn } from './auth/SignIn'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './shell/AppShell'

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
npm test
```

Expected: all tests pass (AuthProvider 3, SignIn 3, BottomNav 1 = 7 total).

- [ ] **Step 8: Manual smoke test**

Run `npm run dev`. Sign in. Expected:
- Bottom nav with Home, Log, Stats, More.
- Tapping each switches the screen heading and highlights the tab.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: AppShell with bottom navigation and placeholder screens"
```

---

### Task 10: First-time profile setup

**Files:**
- Create: `src/profile/ProfileSetup.tsx`
- Modify: `src/auth/ProtectedRoute.tsx`

When a user signs in for the first time, `profiles` has no row for them. They need a one-time form to enter their display name + phone.

- [ ] **Step 1: Build ProfileSetup**

Create `src/profile/ProfileSetup.tsx`:

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function ProfileSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      display_name: displayName,
      phone: phone || null,
    })
    setSaving(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold">Welcome — finish setup</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Phone (optional)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !displayName}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Check for profile in ProtectedRoute**

Overwrite `src/auth/ProtectedRoute.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { ProfileSetup } from '../profile/ProfileSetup'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setHasProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setHasProfile(!!data))
  }, [session])

  if (loading) return <div className="p-6">Loading…</div>
  if (!session) return <Navigate to="/signin" replace />
  if (hasProfile === null) return <div className="p-6">Loading profile…</div>
  if (!hasProfile) {
    return <ProfileSetup userId={session.user.id} onDone={() => setHasProfile(true)} />
  }
  return <>{children}</>
}
```

- [ ] **Step 3: Manual end-to-end check**

Run `npm run dev`. Sign out (or create a second test account). Sign in. Expected:
- ProfileSetup form appears the first time.
- Fill in a display name, submit.
- Lands on Home tab with bottom nav.
- Refresh — stays on Home (ProfileSetup doesn't reappear).
- Verify in Supabase Table Editor that a `profiles` row exists for the user.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: first-time profile setup"
```

---

### Task 11: Deploy to Vercel

**Manual prerequisite:** Create a GitHub repo, push this code to it. Sign up for vercel.com (free) if you don't have an account.

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create racquetball-app --private --source=. --remote=origin --push
```

(Or use the GitHub web UI to create the repo, then `git remote add origin <url>` and `git push -u origin main`.)

- [ ] **Step 2: Import to Vercel**

- In Vercel dashboard → Add New → Project → import the `racquetball-app` repo.
- Framework preset: **Vite** (auto-detected).
- Build command: `npm run build`. Output dir: `dist`.
- Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env.local`).
- Deploy.

- [ ] **Step 3: Update Supabase auth URLs**

In Supabase → Authentication → URL Configuration:
- Site URL: your Vercel URL (e.g. `https://racquetball-app.vercel.app`).
- Add `http://localhost:5173` and the Vercel URL to "Additional Redirect URLs".

- [ ] **Step 4: Smoke test on phone**

- On your Android phone, open the Vercel URL in Chrome.
- Sign in.
- Chrome menu → "Install app" or "Add to Home Screen".
- Open the installed app. Expected: full-screen, no browser chrome, racquetball icon.

- [ ] **Step 5: Commit and push any final tweaks**

```bash
git push
```

---

### Task 12: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

Runs `npm test` and `npm run build` on every push and PR. Stops broken code from merging.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: https://placeholder.supabase.co
          VITE_SUPABASE_ANON_KEY: placeholder
```

(The build step needs the env vars to exist or the client throws; placeholders are fine for a build smoke test since no requests are made at build time.)

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run tests and build on push/PR"
git push
```

- [ ] **Step 3: Verify**

Open the repo on GitHub → Actions tab. Expected: a workflow run named "CI" that completes green. If it fails, click in for logs and fix.

- [ ] **Step 4: Enable branch protection (optional but recommended)**

GitHub repo → Settings → Branches → Add rule for `main`:
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Select the "test" check from the CI workflow

This means you can't push directly to main when a check is failing — forces PRs for substantive changes. Skip if you'd rather push directly.

---

## Self-Review Notes

Coverage against the spec sections relevant to Foundation:

- ✅ Stack & hosting: Vite/React/TS/Tailwind/Supabase/Vercel — Tasks 1–4, 11
- ✅ Auth (all three methods): Task 7
- ✅ App shell + bottom nav: Task 9
- ✅ Profiles table + RLS: Tasks 5, 10
- ✅ PWA manifest: Task 3
- ⏭ Leagues / matches / contacts / standings / schedule / PDF — deferred to plans 2–5

Out of scope for this plan (will be addressed in later plans):
- `leagues`, `league_members`, `contacts`, `matches`, `league_schedule` tables and screens
- Scoring logic (`lib/scoring.ts`)
- SMS link builder (`lib/sms.ts`)
- PDF parsing serverless function

No placeholders. Type names consistent across tasks. Each task ends with a working commit.
