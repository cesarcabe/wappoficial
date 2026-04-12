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

// NOTE: vi.mock is hoisted by Vitest to the top of the module — these mocks apply to the
// entire file, not just the Gemini describe block. Safe here because the OpenAI provider
// does not import 'ai' or '@ai-sdk/google'.
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

// ============================================================
// Transcription Factory
// ============================================================
import { getTranscriptionProvider } from './factory'

// Mock Supabase admin client
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(),
}))

describe('getTranscriptionProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  it('returns OpenAITranscriptionProvider when openai_api_key is in DB', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                { key: 'openai_api_key', value: 'sk-from-db' },
                { key: 'google_api_key', value: 'gk-from-db' },
              ],
              error: null,
            }),
        }),
      }),
    } as any)

    const provider = await getTranscriptionProvider()
    expect(provider).toBeInstanceOf(OpenAITranscriptionProvider)
    expect(provider?.name).toBe('openai')
  })

  it('returns GeminiTranscriptionProvider when only google_api_key is in DB', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [{ key: 'google_api_key', value: 'gk-only' }],
              error: null,
            }),
        }),
      }),
    } as any)

    const provider = await getTranscriptionProvider()
    expect(provider?.name).toBe('gemini')
  })

  it('falls back to env var OPENAI_API_KEY when DB has no keys', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as any)
    process.env.OPENAI_API_KEY = 'sk-from-env'

    const provider = await getTranscriptionProvider()
    expect(provider?.name).toBe('openai')
  })

  it('returns null when no API keys are configured anywhere', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as any)

    const provider = await getTranscriptionProvider()
    expect(provider).toBeNull()
  })
})

// ============================================================
// transcribeAudio (public API)
// ============================================================
import { transcribeAudio } from './index'

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  })

  it('returns null and warns when no provider is available', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as any)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await transcribeAudio(Buffer.from('audio'), 'audio/ogg')

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No transcription provider'))
    warnSpy.mockRestore()
  })

  it('returns text and transcriptionResult on success via OpenAI provider', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [{ key: 'openai_api_key', value: 'sk-test' }],
              error: null,
            }),
        }),
      }),
    } as any)

    // Note: fetch is mocked globally (vi.stubGlobal) earlier in this file
    const mockFetchForIndex = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Quero marcar uma consulta' }),
    })
    vi.stubGlobal('fetch', mockFetchForIndex)

    const result = await transcribeAudio(Buffer.from('audio-data'), 'audio/ogg')

    expect(result).not.toBeNull()
    expect(result!.text).toBe('Quero marcar uma consulta')
    expect(result!.transcriptionResult?.provider).toBe('openai')
  })
})
