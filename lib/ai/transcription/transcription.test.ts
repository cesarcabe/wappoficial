import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAITranscriptionProvider, OPENAI_WHISPER_MODEL } from './providers/openai'
import { mimeTypeToExtension } from './types'

// ============================================================
// mimeTypeToExtension helper
// ============================================================
describe('mimeTypeToExtension', () => {
  it('maps audio/ogg to ogg', () => {
    expect(mimeTypeToExtension('audio/ogg')).toBe('ogg')
  })
  it('strips codec parameters from ogg', () => {
    expect(mimeTypeToExtension('audio/ogg; codecs=opus')).toBe('ogg')
  })
  it('maps audio/mpeg to mp3', () => {
    expect(mimeTypeToExtension('audio/mpeg')).toBe('mp3')
  })
  it('maps audio/mp4 to m4a', () => {
    expect(mimeTypeToExtension('audio/mp4')).toBe('m4a')
  })
  it('falls back to ogg for unknown types', () => {
    expect(mimeTypeToExtension('audio/unknown')).toBe('ogg')
  })
})

// ============================================================
// OpenAI Whisper Provider
// ============================================================
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OpenAITranscriptionProvider', () => {
  beforeEach(() => vi.resetAllMocks())

  it('calls OpenAI transcriptions endpoint with correct FormData and returns text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Olá, tudo bem?' }),
    })

    const provider = new OpenAITranscriptionProvider('sk-test')
    const result = await provider.transcribe({
      buffer: Buffer.from('fake-audio'),
      mimeType: 'audio/ogg',
      language: 'pt',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      })
    )
    expect(result.text).toBe('Olá, tudo bem?')
    expect(result.provider).toBe('openai')
    expect(result.model).toBe(OPENAI_WHISPER_MODEL)
    expect(result.language).toBe('pt')
  })

  it('throws on non-ok API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"Invalid API key"}}',
    })

    const provider = new OpenAITranscriptionProvider('bad-key')
    await expect(
      provider.transcribe({ buffer: Buffer.from('x'), mimeType: 'audio/ogg' })
    ).rejects.toThrow('401')
  })

  it('trims whitespace from transcribed text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: '  Boa tarde.  \n' }),
    })
    const provider = new OpenAITranscriptionProvider('sk-test')
    const result = await provider.transcribe({
      buffer: Buffer.from('audio'),
      mimeType: 'audio/mpeg',
    })
    expect(result.text).toBe('Boa tarde.')
  })

  it('isConfigured returns true when apiKey is set', async () => {
    const provider = new OpenAITranscriptionProvider('sk-key')
    expect(await provider.isConfigured()).toBe(true)
  })

  it('isConfigured returns false for empty string', async () => {
    const provider = new OpenAITranscriptionProvider('')
    expect(await provider.isConfigured()).toBe(false)
  })
})
