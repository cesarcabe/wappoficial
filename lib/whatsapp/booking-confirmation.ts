export type ConfirmationLabels = Record<string, string> | null | undefined

export type BookingConfirmationFields = {
  selectedDate: string | null
  selectedSlot: string | null
  service: string | null
  customerName: string | null
  customerPhone: string | null
  notes: string | null
}

type ExtractBookingFieldsInput = {
  responseObj: Record<string, unknown>
  fieldLabelMap?: Record<string, string> | null
  labelsFromConfig?: ConfirmationLabels
}

const KEY_ALIASES = {
  selectedDate: ['selected_date', 'date', 'booking_date', 'appointment_date', 'data', 'dia'],
  selectedSlot: ['selected_slot', 'slot', 'time', 'time_slot', 'booking_time', 'appointment_time', 'horario', 'hora'],
  service: ['selected_service', 'service', 'service_type', 'tipo_servico', 'servico', 'atendimento'],
  customerName: ['customer_name', 'name', 'nome', 'client_name', 'contact_name'],
  customerPhone: ['customer_phone', 'phone', 'telefone', 'whatsapp', 'contact_phone'],
  notes: ['notes', 'observacoes', 'observacao', 'comments', 'comment', 'note'],
} as const

const KEYWORD_HINTS = {
  date: ['data', 'date', 'dia'],
  time: ['hora', 'horario', 'time', 'slot'],
  service: ['servico', 'service', 'atendimento', 'consulta'],
  name: ['nome', 'name', 'cliente', 'contact'],
  phone: ['telefone', 'phone', 'whatsapp', 'celular'],
  notes: ['observa', 'note', 'comment'],
} as const

function normalizeText(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function looksLikeIsoDateTime(value: string): boolean {
  const v = String(value || '').trim()
  if (!v) return false
  return /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(v) || !Number.isNaN(Date.parse(v))
}

function normalizeStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getLabelForKey(input: ExtractBookingFieldsInput, key: string): string {
  const fromConfig = input.labelsFromConfig && typeof input.labelsFromConfig[key] === 'string'
    ? String(input.labelsFromConfig[key]).trim()
    : ''
  if (fromConfig) return fromConfig
  const fromMap = input.fieldLabelMap && typeof input.fieldLabelMap[key] === 'string'
    ? String(input.fieldLabelMap[key]).trim()
    : ''
  return fromMap
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term))
}

function findByAliases(
  input: ExtractBookingFieldsInput,
  aliases: readonly string[],
): string | null {
  const lowered = new Set(aliases.map((x) => normalizeText(x)))
  for (const [key, rawValue] of Object.entries(input.responseObj || {})) {
    const keyNorm = normalizeText(key)
    if (!lowered.has(keyNorm)) continue
    const value = normalizeStringValue(rawValue)
    if (value) return value
  }
  return null
}

function findDateValue(input: ExtractBookingFieldsInput): string | null {
  const direct = findByAliases(input, KEY_ALIASES.selectedDate)
  if (direct && looksLikeIsoDate(direct)) return direct
  if (direct && looksLikeIsoDateTime(direct)) return direct.slice(0, 10)

  for (const [key, rawValue] of Object.entries(input.responseObj || {})) {
    const value = normalizeStringValue(rawValue)
    if (!value) continue
    const keyNorm = normalizeText(key)
    const labelNorm = normalizeText(getLabelForKey(input, key))
    const keyOrLabel = `${keyNorm} ${labelNorm}`.trim()

    if (looksLikeIsoDate(value) && includesAny(keyOrLabel, KEYWORD_HINTS.date)) {
      return value
    }

    if (looksLikeIsoDate(value)) {
      return value
    }

    if (looksLikeIsoDateTime(value) && includesAny(keyOrLabel, [...KEYWORD_HINTS.date, ...KEYWORD_HINTS.time])) {
      return value.slice(0, 10)
    }
  }

  for (const key of Object.keys(input.responseObj || {})) {
    const keyNorm = normalizeText(key)
    if (/^\d{4}-\d{2}-\d{2}$/.test(keyNorm)) return keyNorm
  }

  return null
}

function findSlotValue(input: ExtractBookingFieldsInput): string | null {
  const direct = findByAliases(input, KEY_ALIASES.selectedSlot)
  if (direct) return direct

  for (const [key, rawValue] of Object.entries(input.responseObj || {})) {
    const value = normalizeStringValue(rawValue)
    if (!value) continue
    if (!looksLikeIsoDateTime(value)) continue
    const keyNorm = normalizeText(key)
    const labelNorm = normalizeText(getLabelForKey(input, key))
    const keyOrLabel = `${keyNorm} ${labelNorm}`.trim()
    if (includesAny(keyOrLabel, KEYWORD_HINTS.time)) {
      return value
    }
  }

  return null
}

function findTextByRole(
  input: ExtractBookingFieldsInput,
  aliases: readonly string[],
  hints: readonly string[],
): string | null {
  const direct = findByAliases(input, aliases)
  if (direct) return direct

  for (const [key, rawValue] of Object.entries(input.responseObj || {})) {
    const value = normalizeStringValue(rawValue)
    if (!value) continue
    if (looksLikeIsoDate(value) || looksLikeIsoDateTime(value)) continue
    const keyNorm = normalizeText(key)
    const labelNorm = normalizeText(getLabelForKey(input, key))
    const keyOrLabel = `${keyNorm} ${labelNorm}`.trim()
    if (includesAny(keyOrLabel, hints)) {
      return value
    }
  }

  return null
}

export function extractBookingConfirmationFields(
  input: ExtractBookingFieldsInput,
): BookingConfirmationFields {
  return {
    selectedDate: findDateValue(input),
    selectedSlot: findSlotValue(input),
    service: findTextByRole(input, KEY_ALIASES.service, KEYWORD_HINTS.service),
    customerName: findTextByRole(input, KEY_ALIASES.customerName, KEYWORD_HINTS.name),
    customerPhone: findTextByRole(input, KEY_ALIASES.customerPhone, KEYWORD_HINTS.phone),
    notes: findTextByRole(input, KEY_ALIASES.notes, KEYWORD_HINTS.notes),
  }
}
