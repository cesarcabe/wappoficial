import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getWhatsAppMediaInfo, downloadWhatsAppMedia } from './media-download'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getWhatsAppMediaInfo', () => {
  it('returns url and mimeType from Graph API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123',
        mime_type: 'audio/ogg',
        file_size: 40960,
        sha256: 'abc123',
        id: 'media-id-123',
      }),
    })

    const result = await getWhatsAppMediaInfo('media-id-123', 'access-token-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v24.0/media-id-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-abc',
        }),
      })
    )
    expect(result.url).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123')
    expect(result.mimeType).toBe('audio/ogg')
    expect(result.id).toBe('media-id-123')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    })

    await expect(getWhatsAppMediaInfo('bad-id', 'token')).rejects.toThrow('400')
  })
})

describe('downloadWhatsAppMedia', () => {
  it('fetches media URL first, then downloads binary with Authorization header', async () => {
    const fakeAudioBuffer = Buffer.from('fake-ogg-data')
    const fakeArrayBuffer = fakeAudioBuffer.buffer.slice(
      fakeAudioBuffer.byteOffset,
      fakeAudioBuffer.byteOffset + fakeAudioBuffer.byteLength
    )

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://cdn.example.com/audio.ogg',
          mime_type: 'audio/ogg',
          id: 'media-id-456',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeArrayBuffer,
      })

    const result = await downloadWhatsAppMedia('media-id-456', 'my-token')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://cdn.example.com/audio.ogg',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'User-Agent': 'curl/7.64.0',
        }),
      })
    )
    expect(result.mimeType).toBe('audio/ogg')
    expect(Buffer.isBuffer(result.buffer)).toBe(true)
  })
})
