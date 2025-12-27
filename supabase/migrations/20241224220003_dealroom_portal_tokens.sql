-- Migration: dealroom_portal_tokens
-- Created: 2024-12-24T22:00:03
-- Description: Portal tokens table and RPCs for stakeholder access

-- Create portal tokens table
CREATE TABLE IF NOT EXISTS public.dealroom_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  deal_id uuid NOT NULL,
  stakeholder_name text NOT NULL,
  stakeholder_type text NOT NULL,
  capabilities jsonb DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_count int DEFAULT 0
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_dealroom_portal_tokens_token
  ON public.dealroom_portal_tokens(token);

-- Create index for deal_id lookups
CREATE INDEX IF NOT EXISTS idx_dealroom_portal_tokens_deal_id
  ON public.dealroom_portal_tokens(deal_id);

-- Enable RLS
ALTER TABLE public.dealroom_portal_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tokens viewable by creator
CREATE POLICY "Portal tokens viewable by creator"
  ON public.dealroom_portal_tokens
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policy: Tokens insertable by authenticated users
CREATE POLICY "Portal tokens insertable by authenticated users"
  ON public.dealroom_portal_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.dealroom_portal_tokens IS
  'Stores portal access tokens for stakeholders';

-- Create portal token RPC
CREATE OR REPLACE FUNCTION public.create_portal_token(
  p_deal_id uuid,
  p_stakeholder_name text,
  p_stakeholder_type text,
  p_capabilities jsonb,
  p_expires_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_token_id uuid;
BEGIN
  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'base64');
  -- Replace URL-unsafe characters
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  -- Insert the token record
  INSERT INTO public.dealroom_portal_tokens (
    token,
    deal_id,
    stakeholder_name,
    stakeholder_type,
    capabilities,
    expires_at,
    created_by
  ) VALUES (
    v_token,
    p_deal_id,
    p_stakeholder_name,
    p_stakeholder_type,
    p_capabilities,
    p_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_token_id;

  RETURN json_build_object(
    'id', v_token_id,
    'token', v_token,
    'expires_at', p_expires_at
  );
END;
$$;

-- Validate portal token RPC
CREATE OR REPLACE FUNCTION public.validate_portal_token_v2(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record record;
  v_deal record;
  v_property record;
BEGIN
  -- Find the token
  SELECT * INTO v_token_record
  FROM public.dealroom_portal_tokens
  WHERE token = p_token
  LIMIT 1;

  -- Check if token exists
  IF v_token_record IS NULL THEN
    RETURN json_build_object('is_valid', false, 'error', 'Token not found');
  END IF;

  -- Check if token is expired
  IF v_token_record.expires_at < now() THEN
    RETURN json_build_object('is_valid', false, 'error', 'Token expired');
  END IF;

  -- Update access tracking
  UPDATE public.dealroom_portal_tokens
  SET
    last_accessed_at = now(),
    access_count = access_count + 1
  WHERE id = v_token_record.id;

  -- Fetch deal information
  SELECT id, name, stage, exit_strategy, purchase_price, arv
  INTO v_deal
  FROM public.dealroom_deals
  WHERE id = v_token_record.deal_id
  LIMIT 1;

  -- Fetch property information
  SELECT id, address, city, state, zip, bedrooms, bathrooms, sqft, year_built
  INTO v_property
  FROM public.dealroom_properties
  WHERE deal_id = v_token_record.deal_id
  LIMIT 1;

  -- Return validated token data
  RETURN json_build_object(
    'is_valid', true,
    'deal_id', v_token_record.deal_id,
    'stakeholder_name', v_token_record.stakeholder_name,
    'stakeholder_type', v_token_record.stakeholder_type,
    'capabilities', v_token_record.capabilities,
    'expires_at', v_token_record.expires_at,
    'deal', CASE WHEN v_deal IS NOT NULL THEN json_build_object(
      'id', v_deal.id,
      'name', v_deal.name,
      'stage', v_deal.stage,
      'exit_strategy', v_deal.exit_strategy,
      'purchase_price', v_deal.purchase_price,
      'arv', v_deal.arv
    ) ELSE NULL END,
    'property', CASE WHEN v_property IS NOT NULL THEN json_build_object(
      'id', v_property.id,
      'address', v_property.address,
      'city', v_property.city,
      'state', v_property.state,
      'zip', v_property.zip,
      'bedrooms', v_property.bedrooms,
      'bathrooms', v_property.bathrooms,
      'sqft', v_property.sqft,
      'year_built', v_property.year_built
    ) ELSE NULL END
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_portal_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_portal_token_v2 TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION public.create_portal_token IS
  'Creates a new portal access token for a stakeholder';
COMMENT ON FUNCTION public.validate_portal_token_v2 IS
  'Validates a portal token and returns deal/property information';
