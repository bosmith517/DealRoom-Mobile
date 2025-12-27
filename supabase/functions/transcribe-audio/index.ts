/**
 * Transcribe Audio Edge Function
 *
 * Accepts base64-encoded audio and returns transcript using OpenAI Whisper.
 *
 * Environment variables required:
 * - OPENAI_API_KEY: Your OpenAI API key
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscribeRequest {
  audio: string // Base64 encoded audio
  mimeType?: string // e.g., 'audio/m4a', 'audio/wav'
  language?: string // e.g., 'en', 'es'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate API key
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    // Parse request body
    const body: TranscribeRequest = await req.json()

    if (!body.audio) {
      throw new Error('Missing audio data')
    }

    // Decode base64 audio to binary
    const binaryAudio = Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0))

    // Determine file extension from mime type
    const mimeType = body.mimeType || 'audio/m4a'
    const extension = mimeType.includes('wav') ? 'wav' :
                      mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' :
                      mimeType.includes('webm') ? 'webm' : 'm4a'

    // Create form data for OpenAI API
    const formData = new FormData()
    const audioBlob = new Blob([binaryAudio], { type: mimeType })
    formData.append('file', audioBlob, `audio.${extension}`)
    formData.append('model', 'whisper-1')

    // Add language hint if provided
    if (body.language) {
      formData.append('language', body.language)
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()

    return new Response(
      JSON.stringify({
        transcript: result.text,
        language: result.language || body.language,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Transcription error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Transcription failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
