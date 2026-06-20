# Wave 4 — AI, Automation & Launch Hardening

**Run order:** after `wave-03`. Paste `sql/wave-04/phase.sql`, then `verification.sql`.

**Installs:** ai_generations (history + logging), ai_prompt_templates,
ai_saved_outputs, automations, automation_runs, automation_logs. All tables are
**agency-only** (client_user has no AI/automation access). Members read; admins
write; any permitted member can insert ai_generations (actor logging).

## AI provider (server-side — keys never in client or DB)
AI generation runs through a **Supabase Edge Function** at
`supabase/functions/ai-generate`. To enable it:

1. Install the Supabase CLI and link your project.
2. Set the provider secret (NOT committed):
   `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
   (optional) `supabase secrets set AI_MODEL=claude-sonnet-4-6`
3. Deploy: `supabase functions deploy ai-generate`

Until the secret is set, the function returns `{ not_configured: true }` and the
UI shows a clear "Add your AI provider key" message — no errors, no fake output.

**Automation engine note:** automations are stored and runnable on demand
(manual trigger) from the UI; date/status-based scheduled execution requires a
scheduler (Supabase cron / Edge Function) — flagged as the remaining piece.
Failure handling (notify admin, activity + automation log, retry max 3) is
modeled in `automation_runs`/`automation_logs`.

**Rollback:** `rollback.sql`.
