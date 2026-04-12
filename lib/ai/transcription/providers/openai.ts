/**
 * OpenAI Whisper Transcription Provider
 *
 * Uses the whisper-1 model via a direct fetch call to the OpenAI API.
 * The raw `openai` npm package is not in this project's deps, so we call
 * the REST endpoint directly with multipart/form-data.
 *
 * whisper-1 is the recommended model for PT-BR (best accuracy, low cost).
 *
 * @see https://platform.openai.com/docs/api-reference/audio/createTranscription
 */

import type { TranscriptionProvider, TranscriptionParams, TranscriptionResult } from '../types'
import { mimeTypeToExtension } from '../types'

export const OPENAI_WHISPER_MODEL = 'whisper-1'

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  name = 'openai'

  constructor(private readonly apiKey: string) {}

  async transcribe({
    buffer,
    mimeType,
    language = 'pt',
  }: TranscriptionParams): Promise<TranscriptionResult> {
    const ext = mimeTypeToExtension(mimeType)

    // Whisper identifies the audio format from the file extension in the filename
    // Uint8Array.from() copies bytes into a fresh ArrayBuffer (satisfies Blob's BlobPart constraint)
    const blob = new Blob([Uint8Array.from(buffer)], { type: mimeType })
    const formData = new FormData()
    formData.append('file', blob, `audio.${ext}`)
    formData.append('model', OPENAI_WHISPER_MODEL)
    formData.append('language', language)
    formData.append('response_format', 'json')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        // Content-Type is NOT set manually: fetch sets multipart boundary automatically
      },
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`[transcription:openai] HTTP ${response.status}: ${errorBody}`)
    }

    const data = (await response.json()) as { text?: string }
    console.log(
      `[transcription:openai] Transcribed ${(data.text ?? '').trim().length} chars, language: ${language}`
    )
    return {
      text: (data.text ?? '').trim(),
      provider: this.name,
      model: OPENAI_WHISPER_MODEL,
      language,
    }
  }

  async isConfigured(): Promise<boolean> {
    return !!this.apiKey
  }
}
