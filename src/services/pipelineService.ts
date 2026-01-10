/**
 * Pipeline Service
 *
 * Service for managing deal pipelines in the mobile app.
 * Supports multi-pipeline workflow for real estate deals.
 */

import { supabase } from '../lib/supabase'

// Pipeline types
export type PipelineType =
  | 'acquisition'
  | 'disposition'
  | 'wholesale'
  | 'rehab'
  | 'lending'
  | 'rental'
  | 'custom'

export interface Pipeline {
  id: string
  tenant_id: string
  name: string
  description?: string
  pipeline_type: PipelineType
  icon?: string
  color: string
  is_active: boolean
  is_default: boolean
  sort_order: number
  deal_count: number
  total_value: number
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  tenant_id: string
  pipeline_id: string
  name: string
  description?: string
  legacy_stage_key?: string
  stage_type: 'lead' | 'active' | 'won' | 'lost' | 'on_hold'
  color: string
  icon?: string
  sort_order: number
  win_probability: number
  expected_days?: number
  is_entry_stage: boolean
  is_exit_stage: boolean
  deal_count: number
  created_at: string
}

// Pipeline service
export const pipelineService = {
  /**
   * Get all active pipelines for the current tenant
   */
  async getPipelines(): Promise<{
    data: Pipeline[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_pipelines')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return { data: data as Pipeline[], error: null }
    } catch (err) {
      console.error('[pipelineService] Error fetching pipelines:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get the default pipeline
   */
  async getDefaultPipeline(): Promise<{
    data: Pipeline | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_pipelines')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single()

      if (error) throw error

      return { data: data as Pipeline, error: null }
    } catch (err) {
      console.error('[pipelineService] Error fetching default pipeline:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get a specific pipeline by ID
   */
  async getPipeline(pipelineId: string): Promise<{
    data: Pipeline | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_pipelines')
        .select('*')
        .eq('id', pipelineId)
        .single()

      if (error) throw error

      return { data: data as Pipeline, error: null }
    } catch (err) {
      console.error('[pipelineService] Error fetching pipeline:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get stages for a pipeline
   */
  async getPipelineStages(pipelineId: string): Promise<{
    data: PipelineStage[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return { data: data as PipelineStage[], error: null }
    } catch (err) {
      console.error('[pipelineService] Error fetching pipeline stages:', err)
      return { data: null, error: err as Error }
    }
  },
}
