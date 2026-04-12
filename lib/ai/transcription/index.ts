/**
 * Audio Transcription Service
 *
 * Transcribes audio buffers to text using the best available AI provider.
 * Priority: OpenAI Whisper (best PT-BR) → Gemini (fallback).
 *
 * This is a best-effort service: callers should catch errors and degrade gracefully.
 *
 * @example
 * ```ts
 * import { transcribeAudio } from '@/lib/ai/transcription'
 *
 * const result = await transcribeAudio(audioBuffer, 'audio/ogg')
 * if (result) {
 *   console.log(result.text) // "Olá, gostaria de agendar uma consulta..."
 * }
 * ```
 */

// Re-export types for consumers
export * from './types'
export { getTranscriptionProvider, type TranscriptionProviderName } from './factory'
export { OpenAITranscriptionProvider, OPENAI_WHISPER_MODEL } from './providers/openai'
export { GeminiTranscriptionProvider, DEFAULT_GEMINI_TRANSCRIPTION_MODEL } from './providers/gemini'

import { getTranscriptionProvider } from './factory'
import type { TranscriptionResult } from './types'

export interface TranscribeAudioResult {
  /** The transcribed text string */
  text: string
  /** Full result from the provider (includes provider name and model) */
  transcriptionResult?: TranscriptionResult
}

/**
 * Transcribes an audio buffer to text.
 *
 * @param buffer - Raw audio binary data (e.g., from `downloadWhatsAppMedia`)
 * @param mimeType - MIME type of the audio (e.g., 'audio/ogg', 'audio/mpeg')
 * @param language - Language hint (default: 'pt' for Brazilian Portuguese)
 * @returns Transcription result, or null if no provider is configured
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  language = 'pt'
): Promise<TranscribeAudioResult | null> {
  const provider = await getTranscriptionProvider()

  if (!provider) {
    console.warn(
      '[transcription] No transcription provider available — configure openai_api_key or google_api_key in Settings'
    )
    return null
  }

  console.log(
    `[transcription] Transcribing ${buffer.length} bytes (${mimeType}) with ${provider.name}...`
  )

  const result = await provider.transcribe({ buffer, mimeType, language })

  console.log(`[transcription] ✅ ${provider.name}: "${result.text.slice(0, 80)}..."`)

  return {
    text: result.text,
    transcriptionResult: result,
  }
}
