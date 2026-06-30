-- ============================================================
-- Wave: Projects & Workspace — Step 05
-- Proposal auto-expiry infrastructure.
-- Strategy:
--   Primary:   pg_cron scheduled job (every 30 min)
--   Secondary: page-load call to expire_overdue_proposals() RPC
-- ============================================================

-- Add per-agency expiry config (in days). Default: 7.
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS proposal_expiry_days smallint NOT NULL DEFAULT 7;

-- RPC: expire proposals where expires_at has passed.
-- Called by both pg_cron and the frontend on page load.
CREATE OR REPLACE FUNCTION expire_overdue_proposals()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _affected int;
BEGIN
  UPDATE proposals
    SET status = 'expired', updated_at = now()
  WHERE status IN ('sent', 'viewed')
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_overdue_proposals() TO authenticated;

-- RPC: set expires_at based on agency's configured days when sending a proposal.
CREATE OR REPLACE FUNCTION set_proposal_expiry(_proposal_id uuid, _agency_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _days smallint;
  _expiry timestamptz;
BEGIN
  SELECT COALESCE(proposal_expiry_days, 7) INTO _days FROM agencies WHERE id = _agency_id;
  _expiry := now() + (_days || ' days')::interval;

  UPDATE proposals
    SET expires_at = _expiry, sent_at = now(), status = 'sent', updated_at = now()
  WHERE id = _proposal_id;

  RETURN _expiry;
END;
$$;

GRANT EXECUTE ON FUNCTION set_proposal_expiry(uuid, uuid) TO authenticated;

-- ── pg_cron schedule ─────────────────────────────────────────
-- Requires the pg_cron extension. Enable it in Supabase dashboard:
-- Database → Extensions → pg_cron → Enable
-- Then uncomment the block below and run it once:
--
-- SELECT cron.schedule(
--   'expire-proposals',
--   '*/30 * * * *',
--   $$ SELECT expire_overdue_proposals(); $$
-- );
