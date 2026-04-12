/**
 * Audio Transcription Provider System — Types and Interfaces
 *
 * Follows the same pattern as lib/ai/ocr/types.ts.
 */

/** Parameters passed to every transcription provider */
export interface TranscriptionParams {
  /** Raw audio binary data */
  buffer: Buffer
  /** MIME type of the audio (e.g., 'audio/ogg', 'audio/mpeg') */
  mimeType: string
  /** Language hint for the provider (e.g., 'pt' for Portuguese). Default: 'pt' */
  language?: string
}

/** Result returned by every transcription provider */
export interface TranscriptionResult {
  /** Transcribed text (trimmed) */
  text: string
  /** Name of the provider that performed the transcription */
  provider: string
  /** Model used (if applicable) */
  model?: string
  /** Language used or detected */
  language?: string
}

/** Contract that every transcription provider must implement */
export interface TranscriptionProvider {
  /** Human-readable provider name (e.g., 'openai', 'gemini') */
  name: string
  /** Transcribes the audio buffer and returns text */
  transcribe(params: TranscriptionParams): Promise<TranscriptionResult>
  /** Returns true if the provider has an API key configured */
  isConfigured(): Promise<boolean>
}

/**
 * Maps WhatsApp audio MIME types to file extensions.
 *
 * WhatsApp sends OGG/OPUS for voice notes (PTT), and MP3/M4A/AAC for audio file uploads.
 * OpenAI Whisper needs a recognizable file extension in the multipart filename.
 *
 * Codec parameters (e.g., 'audio/ogg; codecs=opus') are stripped.
 */
export function mimeTypeToExtension(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
    'audio/3gpp': '3gp',
  }
  return map[base] ?? 'ogg'
}
