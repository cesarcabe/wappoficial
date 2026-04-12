/**
 * WhatsApp Media Download
 *
 * Two-step process to retrieve media from Meta Graph API:
 * 1. GET media metadata (temporary CDN URL) using the media ID
 * 2. GET binary content from the CDN URL with Authorization header
 *
 * Meta CDN URLs expire after a short window (~5 minutes).
 * The User-Agent header is required by Meta's CDN.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 */

const GRAPH_API_VERSION = 'v24.0'

export interface WhatsAppMediaInfo {
  /** Temporary CDN URL to download the media binary */
  url: string
  /** MIME type reported by Meta (e.g., 'audio/ogg', 'audio/mpeg') */
  mimeType: string
  /** File size in bytes (may be absent) */
  fileSize?: number
  /** SHA-256 hash of the file (may be absent) */
  sha256?: string
  /** Media object ID */
  id: string
}

/**
 * Fetches metadata for a WhatsApp media object via the Graph API.
 * Returns the temporary CDN URL and MIME type.
 */
export async function getWhatsAppMediaInfo(
  mediaId: string,
  accessToken: string
): Promise<WhatsAppMediaInfo> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    throw new Error(
      `[media-download] Failed to fetch media info for ${mediaId}: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return {
    url: data.url,
    mimeType: data.mime_type,
    fileSize: data.file_size,
    sha256: data.sha256,
    id: data.id,
  }
}

/**
 * Downloads the binary content of a WhatsApp media object.
 * Performs two HTTP requests: one to get the CDN URL, one to download the file.
 *
 * @param mediaId - The media object ID from the webhook payload (message.audio.id)
 * @param accessToken - WhatsApp Business API access token
 * @returns Buffer containing the audio binary data, plus its MIME type
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const mediaInfo = await getWhatsAppMediaInfo(mediaId, accessToken)

  const response = await fetch(mediaInfo.url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Meta CDN requires a User-Agent header; without it, returns 403
      'User-Agent': 'curl/7.64.0',
    },
  })

  if (!response.ok) {
    throw new Error(
      `[media-download] Failed to download media ${mediaId}: ${response.status} ${response.statusText}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mediaInfo.mimeType,
  }
}
