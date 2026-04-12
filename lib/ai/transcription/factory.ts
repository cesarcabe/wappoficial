/**
 * Transcription Provider Factory
 *
 * Selects the best available transcription provider in this order:
 *   1. OpenAI Whisper (openai_api_key) — best PT-BR accuracy
 *   2. Gemini multimodal (google_api_key) — fallback
 *
 * Reads API keys from Supabase settings (same keys used by other AI services).
 * Falls back to environment variables for local dev / CI.
 *
 * Settings consulted (no new settings required):
 *   - openai_api_key  → enables OpenAI Whisper
 *   - google_api_key  → enables Gemini fallback
 *   - gemini_api_key  → legacy alias for google_api_key
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { OpenAITranscriptionProvider } from './providers/openai'
import { GeminiTranscriptionProvider } from './providers/gemini'
import type { TranscriptionProvider } from './types'

export type TranscriptionProviderName = 'openai' | 'gemini'

/**
 * Returns the best-available transcription provider.
 * Prefers OpenAI Whisper; falls back to Gemini.
 * Returns null if neither provider has an API key configured.
 */
export async function getTranscriptionProvider(): Promise<TranscriptionProvider | null> {
  let openaiApiKey: string | undefined
  let googleApiKey: string | undefined

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['openai_api_key', 'google_api_key', 'gemini_api_key'])

    const map = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) ?? [])
    openaiApiKey = map.get('openai_api_key') || undefined
    googleApiKey = map.get('google_api_key') || map.get('gemini_api_key') || undefined
  }

  // Env var fallbacks (for local dev and CI)
  openaiApiKey = openaiApiKey || process.env.OPENAI_API_KEY || undefined
  googleApiKey =
    googleApiKey ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    undefined

  if (openaiApiKey) {
    return new OpenAITranscriptionProvider(openaiApiKey)
  }

  if (googleApiKey) {
    return new GeminiTranscriptionProvider(googleApiKey)
  }

  console.warn(
    '[transcription] No transcription provider available — configure openai_api_key or google_api_key in Settings'
  )
  return null
}
