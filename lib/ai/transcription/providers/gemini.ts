/**
 * Gemini Audio Transcription Provider
 *
 * Uses Gemini's multimodal capability to transcribe audio.
 * Follows the same pattern as lib/ai/ocr/providers/gemini.ts.
 *
 * This is the fallback when OpenAI Whisper is not configured.
 * Gemini supports audio natively via the file/inline data content type.
 *
 * @see https://ai.google.dev/gemini-api/docs/audio
 */

import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { TranscriptionProvider, TranscriptionParams, TranscriptionResult } from '../types'

export const DEFAULT_GEMINI_TRANSCRIPTION_MODEL = 'gemini-2.5-flash'

// Portuguese-first prompt; asks for verbatim transcription only
const TRANSCRIPTION_PROMPT = `Transcreva o áudio a seguir na língua original do falante.
Retorne APENAS o texto transcrito — sem prefixos, legendas, carimbos de tempo ou explicações.
Se o áudio não contiver fala inteligível, retorne exatamente: [áudio sem conteúdo de voz]`

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  name = 'gemini'

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string = DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
  ) {}

  async transcribe({ buffer, mimeType }: TranscriptionParams): Promise<TranscriptionResult> {
    if (!this.apiKey) throw new Error('Chave Google não configurada. Acesse Configurações → IA.')

    const google = createGoogleGenerativeAI({ apiKey: this.apiKey })
    const model = google(this.modelId)

    // Strip codec parameters: 'audio/ogg; codecs=opus' → 'audio/ogg'
    const baseMimeType = mimeType.split(';')[0].trim() as `audio/${string}`

    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: buffer,
              mediaType: baseMimeType,
            },
            { type: 'text', text: TRANSCRIPTION_PROMPT },
          ],
        },
      ],
    })

    console.log(`[transcription:gemini] Transcribed ${text.trim().length} chars with ${this.modelId}`)

    return {
      text: text.trim(),
      provider: this.name,
      model: this.modelId,
    }
  }

  async isConfigured(): Promise<boolean> {
    return !!this.apiKey
  }
}
