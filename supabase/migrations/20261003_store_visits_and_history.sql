-- ============================================================
-- HONESTY STORE - Store Visits Tracking & History Enhancement
-- Migration Date: 2026-10-03
-- Purpose: Persistent visit tracking (Total & Unique), session debouncing,
--          and optimized order history queries
-- Run in: Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

-- 1. STORE VISITS TABLE
CREATE TABLE IF NOT EXISTS public.store_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id TEXT NOT NULL,
    session_id TEXT,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast aggregation and time-range filtering
CREATE INDEX IF NOT EXISTS idx_store_visits_visitor_id ON public.store_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_visited_at ON public.store_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_visits_visitor_time ON public.store_visits(visitor_id, visited_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

-- Allow public and authenticated clients to insert visits
DROP POLICY IF EXISTS "Public can record visits" ON public.store_visits;
CREATE POLICY "Public can record visits"
ON public.store_visits FOR INSERT
TO public
WITH CHECK (true);

-- Allow public and authenticated clients to read visits for analytics
DROP POLICY IF EXISTS "Public can view visits" ON public.store_visits;
CREATE POLICY "Public can view visits"
ON public.store_visits FOR SELECT
TO public
USING (true);

-- 2. COMMUNITY METRICS TABLE & CONSTRAINT
CREATE TABLE IF NOT EXISTS public.community_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE DEFAULT CURRENT_DATE,
    sales_today NUMERIC DEFAULT 0,
    store_visits BIGINT DEFAULT 0,
    completed_payments BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_metrics_date_key'
    ) THEN
        BEGIN
            ALTER TABLE public.community_metrics ADD CONSTRAINT community_metrics_date_key UNIQUE (date);
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

-- 3. Ensure customer_phone and customer_email indexes on orders table for fast History lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_lookup ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_lookup ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_user_phone_status ON public.orders(customer_phone, status);

-- 4. STORE VISIT RECORDING FUNCTION (RPC)
-- Atomically checks 30-minute session debounce per visitor to prevent inflate on refresh/re-render
CREATE OR REPLACE FUNCTION public.record_store_visit(p_visitor_id TEXT, p_session_id TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_last_visit TIMESTAMPTZ;
  v_recorded BOOLEAN := false;
  v_total_visits BIGINT;
  v_unique_visitors BIGINT;
  v_today_visits BIGINT;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
    RAISE EXCEPTION 'visitor_id is required';
  END IF;

  -- Check if this visitor recorded a visit in the last 30 minutes
  SELECT MAX(visited_at) INTO v_last_visit
  FROM public.store_visits
  WHERE visitor_id = p_visitor_id;

  IF v_last_visit IS NULL OR v_last_visit < (NOW() - INTERVAL '30 minutes') THEN
    INSERT INTO public.store_visits (visitor_id, session_id, visited_at)
    VALUES (p_visitor_id, p_session_id, NOW());
    v_recorded := true;

    -- Also keep community_metrics store_visits counter updated (safely)
    BEGIN
      INSERT INTO public.community_metrics (date, store_visits, sales_today, completed_payments)
      VALUES (CURRENT_DATE, 1, 0, 0)
      ON CONFLICT (date) DO UPDATE
      SET store_visits = COALESCE(public.community_metrics.store_visits, 0) + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- If community_metrics constraint differs, continue without failing visit tracking
        NULL;
    END;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_total_visits, v_unique_visitors
  FROM public.store_visits;

  SELECT COUNT(*)
  INTO v_today_visits
  FROM public.store_visits
  WHERE visited_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'recorded', v_recorded,
    'total_visits', COALESCE(v_total_visits, 0),
    'unique_visitors', COALESCE(v_unique_visitors, 0),
    'today_visits', COALESCE(v_today_visits, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. VISIT METRICS AGGREGATION FUNCTION (RPC)
CREATE OR REPLACE FUNCTION public.get_visit_metrics()
RETURNS JSONB AS $$
DECLARE
  v_total_visits BIGINT;
  v_unique_visitors BIGINT;
  v_today_visits BIGINT;
  v_today_uniques BIGINT;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_total_visits, v_unique_visitors
  FROM public.store_visits;

  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_today_visits, v_today_uniques
  FROM public.store_visits
  WHERE visited_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_visits', COALESCE(v_total_visits, 0),
    'unique_visitors', COALESCE(v_unique_visitors, 0),
    'today_visits', COALESCE(v_today_visits, 0),
    'today_uniques', COALESCE(v_today_uniques, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION public.record_store_visit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_store_visit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_store_visit(TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_visit_metrics() TO anon;
GRANT EXECUTE ON FUNCTION public.get_visit_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_metrics() TO service_role;
