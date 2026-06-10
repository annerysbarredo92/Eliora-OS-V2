# Eliora OS V2 — Deploys

Each folder here is a ready-to-upload Netlify deploy.

## How to deploy to Netlify (drag and drop)

1. Go to netlify.com → your site → Deploys tab
2. Drag the phase folder (e.g. `phase-01-foundation`) directly onto the deploy dropzone
3. Netlify will publish it instantly

## Important: set environment variables in Netlify first

Before deploying, add these in Netlify → Site → Environment Variables:

  VITE_SUPABASE_URL      = https://ncfuhiclcmtovivjabdj.supabase.co
  VITE_SUPABASE_ANON_KEY = sb_publishable_qQMZnjEQwmnbPs6XBSu9kQ_orh-jtNk

Note: environment variables are baked in at build time by Vite.
The files in this folder were already built with those values included.
You do not need to set them again for drag-and-drop deploys of these specific builds.
You DO need them set if Netlify is rebuilding from source (Git-connected deploys).

## Folder index

| Folder | Phase | Date | Notes |
|--------|-------|------|-------|
| phase-01-foundation | Phase 01 Foundation | 2026-06-10 | Auth, routing, design system, all portal shells |
