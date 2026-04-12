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
    const [, callOptions] = mockFetch.mock.calls[0]
    const body = callOptions.body as FormData
    expect(body.get('model')).toBe(OPENAI_WHISPER_MODEL)
    expect(body.get('language')).toBe('pt')
    expect((body.get('file') as File).name).toBe('audio.ogg')
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

// ============================================================
// Gemini Transcription Provider
// ============================================================
import { GeminiTranscriptionProvider, DEFAULT_GEMINI_TRANSCRIPTION_MODEL } from './providers/gemini'

// Mock the AI SDK to avoid real API calls in tests
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'mock-model')),
}))

describe('GeminiTranscriptionProvider', () => {
  beforeEach(() => vi.resetAllMocks())

  it('calls generateText with audio inline data and returns trimmed text', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValueOnce({ text: '  Como posso te ajudar?  ' } as any)

    const provider = new GeminiTranscriptionProvider('gkey-123')
    const result = await provider.transcribe({
      buffer: Buffer.from('fake-audio'),
      mimeType: 'audio/ogg',
    })

    expect(generateText).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(generateText).mock.calls[0][0]
    expect(callArgs.messages[0].content[0].type).toBe('file')
    expect(callArgs.messages[0].content[0].mediaType).toBe('audio/ogg')
    expect(result.text).toBe('Como posso te ajudar?')
    expect(result.provider).toBe('gemini')
    expect(result.model).toBe(DEFAULT_GEMINI_TRANSCRIPTION_MODEL)
  })

  it('strips codec parameters from mimeType before passing to API', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

    const provider = new GeminiTranscriptionProvider('gkey')
    await provider.transcribe({
      buffer: Buffer.from('audio'),
      mimeType: 'audio/ogg; codecs=opus',
    })

    const callArgs = vi.mocked(generateText).mock.calls[0][0]
    expect(callArgs.messages[0].content[0].mediaType).toBe('audio/ogg')
  })

  it('isConfigured returns true when apiKey is set', async () => {
    const provider = new GeminiTranscriptionProvider('gkey')
    expect(await provider.isConfigured()).toBe(true)
  })
})
