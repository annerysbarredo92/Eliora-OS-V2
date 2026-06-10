# Eliora OS V2 — Netlify Deployment Checklist

Use this checklist every time you deploy to Netlify.

---

## 1. Files That Must Exist in GitHub

Before Netlify can build, these must be committed and pushed:

| File | Location | Why |
|------|----------|-----|
| `package.json` | repo root | Netlify reads this to know how to install and build |
| `package-lock.json` | repo root | Ensures reproducible dependency installs |
| `vite.config.ts` | repo root | Tells Vite how to build |
| `tsconfig.json` | repo root | TypeScript configuration |
| `tsconfig.app.json` | repo root | TypeScript app configuration |
| `index.html` | repo root | Vite entry point |
| `netlify.toml` | repo root | Tells Netlify: build command, publish dir, redirect rules |
| `.env.example` | repo root | Documents required env vars (safe to commit — no real values) |
| `src/` | repo root | All application source code |
| `public/` | repo root | Static assets (favicon, icons) |
| `sql/` | repo root | Database migration files |
| `docs/` | repo root | Project documentation |

**Do not commit:**
- `node_modules/` — Netlify installs these itself
- `dist/` — Netlify builds this itself
- `deploys/` — local build snapshots only
- `.env` — real credentials, never in GitHub

---

## 2. Environment Variables Required in Netlify Dashboard

Go to: **Netlify → Your Site → Site Configuration → Environment Variables**

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://ncfuhiclcmtovivjabdj.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_qQMZnjEQwmnbPs6XBSu9kQ_orh-jtNk` | Yes |

> **Important:** Vite bakes environment variables into the build at compile time.
> These must be set in the Netlify dashboard BEFORE triggering a deploy.
> Changing them requires a new deploy to take effect.

---

## 3. Netlify Settings

Go to: **Netlify → Your Site → Site Configuration → Build & Deploy**

| Setting | Value |
|---------|-------|
| Repository | `github.com/annerysbarredo92/Eliora-OS-V2` |
| Branch to deploy | `main` |
| Base directory | *(leave blank)* |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | `20` (set via netlify.toml or environment var `NODE_VERSION=20`) |

> The `netlify.toml` file in the repo root sets these automatically.
> If values in the Netlify dashboard conflict with `netlify.toml`, the dashboard wins.
> Leave the dashboard fields blank to let `netlify.toml` control the build.

---

## 4. Supabase Settings Required

Go to: **Supabase → Your Project → Authentication → URL Configuration**

| Setting | Value |
|---------|-------|
| Site URL | Your Netlify production URL (e.g. `https://eliora-os.netlify.app`) |
| Redirect URLs | `https://eliora-os.netlify.app/**` |

> Without the correct Site URL, Supabase will reject auth redirects (password reset, magic links).
> Update this after Netlify assigns your domain.

**Phase 01 SQL must be run before auth works:**
1. Go to Supabase → SQL Editor
2. Paste: `sql/phase-01-foundation/phase.sql`
3. Run
4. Verify: `sql/phase-01-foundation/verification.sql`

---

## 5. Deployment Verification Steps

After every deploy, verify these in order:

### Step 1 — Build succeeded
- Check Netlify deploy log — should end with `✓ built in Xs`
- No TypeScript errors
- No missing module errors

### Step 2 — Site loads
- Visit your Netlify URL
- App loader appears (infinity animation + "E.")
- Landing page renders

### Step 3 — Routing works
- Navigate to `/pricing` — page loads
- Navigate to a non-existent route — redirects to `/`
- Navigate to `/login` — login form appears
- Refresh any page — does NOT show a 404 (requires the `[[redirects]]` rule in `netlify.toml`)

### Step 4 — Auth works (after Phase 01 SQL is run)
- Go to `/signup`
- Create a test account
- Verify redirect to `/agency/dashboard`
- Sign out
- Sign back in at `/login`
- Verify correct portal redirect based on role

### Step 5 — Supabase connection works
- Open browser DevTools → Network tab
- Sign in
- Confirm requests to `ncfuhiclcmtovivjabdj.supabase.co` return 200
- No 401 or 403 errors on profile fetch

### Step 6 — Portal isolation works
- Sign in as agency user → confirm you land on `/agency`
- Sign in as client user → confirm you land on `/portal`
- Try navigating to `/portal` as agency user → should redirect to `/agency`
- Try navigating to `/agency` as client user → should redirect to `/portal`

---

## Quick Deploy Checklist (use before every push)

```
[ ] All changes committed locally
[ ] npm run build passes locally with no errors
[ ] .env is NOT staged or committed
[ ] netlify.toml is committed
[ ] Environment variables are set in Netlify dashboard
[ ] Pushed to main branch on GitHub
[ ] Netlify auto-deploy triggered (check Netlify deploy log)
[ ] Site URL loads correctly
[ ] Auth flow tested
```
