# Wave 3 — Billing, Reporting & Calendar

**Run order:** after `wave-02`. Paste `sql/wave-03/phase.sql`, then `verification.sql`.

**Installs:** invoices, invoice_items, payments (manual recording), payment_plans,
payment_plan_installments, refunds, content_metrics, kpis, goals, calendar_events,
tasks. Enums for invoice/payment/task/calendar/goal. Trigger recomputes invoice
paid amount + status when a payment is recorded. Client-safe views
`invoices_client`, `calendar_client`.

**Billing note:** there is **no payment processor** — `payments` are MANUAL
RECORDING only (the blueprint payment method). "Recurring billing" is modeled as
scheduling records (`is_recurring`, `recurrence`, `payment_plans`), not charging.

**RLS:** agency manages; clients read their own visible invoices/metrics/
calendar/kpis/goals (via client-safe views + base policies). Payments, plans,
refunds, tasks, invoice_items are agency-only.

**Rollback:** `rollback.sql`.

## Google Sign-In setup (no SQL — Supabase dashboard)
1. Supabase → Authentication → Providers → **Google** → enable.
2. Create OAuth credentials in Google Cloud Console; set the **Authorized redirect URI** to
   `https://<your-project>.supabase.co/auth/v1/callback`.
3. Paste the Client ID + Secret into the Supabase Google provider.
4. Supabase → Authentication → URL Configuration → add your site URL + `/login` to
   **Redirect URLs** (e.g. `http://localhost:5173/login` and your Netlify URL `/login`).
Email+password continues to work alongside Google. (Google sign-ups currently
create an `agency_owner` via the Phase-01 trigger; client Google onboarding needs
the invite flow.)
