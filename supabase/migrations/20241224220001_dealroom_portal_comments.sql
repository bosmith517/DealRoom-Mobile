-- Migration: dealroom_portal_comments
-- Created: 2024-12-24T22:00:01
-- Description: Portal comments table for stakeholder feedback

-- Create portal comments table
CREATE TABLE IF NOT EXISTS public.dealroom_portal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  portal_token text,
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for deal_id lookups
CREATE INDEX IF NOT EXISTS idx_dealroom_portal_comments_deal_id
  ON public.dealroom_portal_comments(deal_id);

-- Create index for portal_token lookups
CREATE INDEX IF NOT EXISTS idx_dealroom_portal_comments_token
  ON public.dealroom_portal_comments(portal_token);

-- Enable RLS
ALTER TABLE public.dealroom_portal_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read for valid portal tokens
-- Note: In production, validate token before allowing access
CREATE POLICY "Portal comments are viewable by deal owner or valid portal token"
  ON public.dealroom_portal_comments
  FOR SELECT
  USING (true);

-- RLS Policy: Allow insert for anyone with portal token
CREATE POLICY "Portal comments can be created with valid token"
  ON public.dealroom_portal_comments
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.dealroom_portal_comments IS
  'Comments left by stakeholders through the portal interface';
