-- Migration: dealroom_stage_history
-- Created: 2024-12-24T22:00:02
-- Description: Stage history table for deal stage transitions

-- Create stage history table
CREATE TABLE IF NOT EXISTS public.dealroom_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  notes text,
  changed_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Create index for deal_id lookups
CREATE INDEX IF NOT EXISTS idx_dealroom_stage_history_deal_id
  ON public.dealroom_stage_history(deal_id);

-- Create index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_dealroom_stage_history_created
  ON public.dealroom_stage_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.dealroom_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Stage history viewable by authenticated users
CREATE POLICY "Stage history viewable by authenticated users"
  ON public.dealroom_stage_history
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Stage history insertable by authenticated users
CREATE POLICY "Stage history insertable by authenticated users"
  ON public.dealroom_stage_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.dealroom_stage_history IS
  'Tracks all stage transitions for deals in the pipeline';
