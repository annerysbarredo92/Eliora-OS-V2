-- Wave 3 Strategy — Phase 02: client_products_services
-- Tracks what the CLIENT sells (products, services, packages, etc.)
-- Entirely separate from the agency's own service catalog.

CREATE TABLE IF NOT EXISTS client_products_services (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id               uuid        NOT NULL REFERENCES agencies(id)  ON DELETE CASCADE,
  client_id               uuid        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,

  name                    text        NOT NULL,
  type                    text        NOT NULL
    CHECK (type IN ('product','service','package','membership','subscription','course','program')),
  description             text,
  target_audience         text,
  benefits                text[]      NOT NULL DEFAULT '{}',
  pricing_type            text        NOT NULL DEFAULT 'fixed'
    CHECK (pricing_type IN ('fixed','range','starting_at','custom','free')),
  price_cents             integer,
  price_min_cents         integer,
  price_max_cents         integer,
  price_label             text,
  status                  text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','seasonal','discontinued')),
  seasonal_availability   text,
  include_in_ai_context   boolean     NOT NULL DEFAULT true,
  sort_order              smallint    NOT NULL DEFAULT 0,

  created_by              uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by              uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE client_products_services IS
  'What the client sells. Used to generate AI content, discovery context, and proposals.';
COMMENT ON COLUMN client_products_services.price_label IS
  'Free-form pricing text override, e.g. "Starting at $2,500/mo". Takes precedence over cents fields for display.';
COMMENT ON COLUMN client_products_services.include_in_ai_context IS
  'When true, this offering is included in AI generation briefs for this client.';
