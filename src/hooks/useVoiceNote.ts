/**
 * useVoiceNote Hook
 *
 * Audio recording and transcription for voice notes in evaluations.
 * Requires: npx expo install expo-av
 * Transcription uses Supabase Edge Function with OpenAI Whisper.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Alert, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'

// Dynamic import to handle missing expo-av gracefully
let Audio: any = null
let audioAvailable = false

try {
  const expoAv = require('expo-av')
  Audio = expoAv.Audio
  audioAvailable = true
} catch (e) {
  console.warn('[VoiceNote] expo-av not installed. Voice notes will be disabled.')
}

export interface VoiceRecording {
  id: string
  uri: string
  durationMs: number
  createdAt: string
  transcript?: string
  isTranscribing?: boolean
  transcriptError?: string
}

export interface UseVoiceNoteResult {
  isAvailable: boolean
  isRecording: boolean
  isPaused: boolean
  durationMs: number
  recordings: VoiceRecording[]
  startRecording: () => Promise<boolean>
  stopRecording: () => Promise<VoiceRecording | null>
  pauseRecording: () => Promise<void>
  resumeRecording: () => Promise<void>
  cancelRecording: () => Promise<void>
  playRecording: (uri: string) => Promise<void>
  stopPlayback: () => Promise<void>
  deleteRecording: (id: string) => void
  transcribeRecording: (id: string) => Promise<string | null>
  isPlaying: boolean
  playingUri: string | null
}

// Supabase URL for edge functions
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

export function useVoiceNote(): UseVoiceNoteResult {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingUri, setPlayingUri] = useState<string | null>(null)

  const recordingRef = useRef<any>(null)
  const soundRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {})
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {})
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!audioAvailable || !Audio) {
      Alert.alert('Not Available', 'Voice notes require expo-av to be installed.')
      return false
    }

    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone access to record voice notes.')
        return false
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      // Create and start recording
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()

      recordingRef.current = recording
      setIsRecording(true)
      setIsPaused(false)
      setDurationMs(0)

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDurationMs((prev) => prev + 100)
      }, 100)

      return true
    } catch (err) {
      console.error('[VoiceNote] Failed to start recording:', err)
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.')
      return false
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<VoiceRecording | null> => {
    if (!recordingRef.current) return null

    try {
      // Stop timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      // Stop and unload recording
      await recordingRef.current.stopAndUnloadAsync()
      const uri = recordingRef.current.getURI()
      const finalDuration = durationMs

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      recordingRef.current = null
      setIsRecording(false)
      setIsPaused(false)
      setDurationMs(0)

      if (!uri) return null

      // Create recording entry
      const newRecording: VoiceRecording = {
        id: `voice_${Date.now()}`,
        uri,
        durationMs: finalDuration,
        createdAt: new Date().toISOString(),
      }

      setRecordings((prev) => [...prev, newRecording])
      return newRecording
    } catch (err) {
      console.error('[VoiceNote] Failed to stop recording:', err)
      recordingRef.current = null
      setIsRecording(false)
      return null
    }
  }, [durationMs])

  const pauseRecording = useCallback(async () => {
    if (!recordingRef.current || !isRecording) return

    try {
      await recordingRef.current.pauseAsync()
      setIsPaused(true)

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    } catch (err) {
      console.error('[VoiceNote] Failed to pause:', err)
    }
  }, [isRecording])

  const resumeRecording = useCallback(async () => {
    if (!recordingRef.current || !isPaused) return

    try {
      await recordingRef.current.startAsync()
      setIsPaused(false)

      durationIntervalRef.current = setInterval(() => {
        setDurationMs((prev) => prev + 100)
      }, 100)
    } catch (err) {
      console.error('[VoiceNote] Failed to resume:', err)
    }
  }, [isPaused])

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return

    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      await recordingRef.current.stopAndUnloadAsync()
      const uri = recordingRef.current.getURI()

      // Delete the file
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true })
      }

      recordingRef.current = null
      setIsRecording(false)
      setIsPaused(false)
      setDurationMs(0)
    } catch (err) {
      console.error('[VoiceNote] Failed to cancel:', err)
    }
  }, [])

  const playRecording = useCallback(async (uri: string) => {
    if (!audioAvailable || !Audio) return

    try {
      // Stop any existing playback
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status: any) => {
          if (status.didJustFinish) {
            setIsPlaying(false)
            setPlayingUri(null)
          }
        }
      )

      soundRef.current = sound
      setIsPlaying(true)
      setPlayingUri(uri)
    } catch (err) {
      console.error('[VoiceNote] Failed to play:', err)
      Alert.alert('Playback Error', 'Failed to play recording.')
    }
  }, [])

  const stopPlayback = useCallback(async () => {
    if (!soundRef.current) return

    try {
      await soundRef.current.stopAsync()
      await soundRef.current.unloadAsync()
      soundRef.current = null
      setIsPlaying(false)
      setPlayingUri(null)
    } catch (err) {
      console.error('[VoiceNote] Failed to stop playback:', err)
    }
  }, [])

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const recording = prev.find((r) => r.id === id)
      if (recording) {
        FileSystem.deleteAsync(recording.uri, { idempotent: true }).catch(() => {})
      }
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  // Transcribe a recording using Supabase Edge Function + OpenAI Whisper
  const transcribeRecording = useCallback(async (id: string): Promise<string | null> => {
    const recording = recordings.find((r) => r.id === id)
    if (!recording) {
      console.error('[VoiceNote] Recording not found:', id)
      return null
    }

    // Mark as transcribing
    setRecordings((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, isTranscribing: true, transcriptError: undefined } : r
      )
    )

    try {
      // Read the audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(recording.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Determine file extension from URI
      const extension = recording.uri.split('.').pop()?.toLowerCase() || 'm4a'
      const mimeType = extension === 'wav' ? 'audio/wav' :
                       extension === 'mp3' ? 'audio/mpeg' : 'audio/m4a'

      // Call the Supabase Edge Function for transcription
      const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType,
          language: 'en', // Default to English
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Transcription failed: ${response.status}`)
      }

      const data = await response.json()
      const transcript = data.transcript || data.text || ''

      // Update recording with transcript
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, transcript, isTranscribing: false } : r
        )
      )

      return transcript
    } catch (err: any) {
      console.error('[VoiceNote] Transcription error:', err)

      // Update recording with error
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, isTranscribing: false, transcriptError: err.message || 'Transcription failed' }
            : r
        )
      )

      Alert.alert('Transcription Error', err.message || 'Failed to transcribe recording.')
      return null
    }
  }, [recordings])

  return {
    isAvailable: audioAvailable,
    isRecording,
    isPaused,
    durationMs,
    recordings,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    playRecording,
    stopPlayback,
    deleteRecording,
    transcribeRecording,
    isPlaying,
    playingUri,
  }
}

// Format milliseconds to mm:ss
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
