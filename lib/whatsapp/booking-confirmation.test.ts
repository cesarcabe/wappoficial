import { describe, expect, it } from 'vitest'

import { extractBookingConfirmationFields } from './booking-confirmation'

describe('extractBookingConfirmationFields', () => {
  it('extracts booking fields from default keys', () => {
    const fields = extractBookingConfirmationFields({
      responseObj: {
        selected_date: '2026-04-16',
        selected_slot: '2026-04-16T15:30:00.000Z',
        selected_service: 'Consulta',
        customer_name: 'Maria',
        customer_phone: '+5511999999999',
        notes: 'Trazer exames',
      },
    })

    expect(fields).toEqual({
      selectedDate: '2026-04-16',
      selectedSlot: '2026-04-16T15:30:00.000Z',
      service: 'Consulta',
      customerName: 'Maria',
      customerPhone: '+5511999999999',
      notes: 'Trazer exames',
    })
  })

  it('extracts fields from dynamic keys using labels map', () => {
    const fields = extractBookingConfirmationFields({
      responseObj: {
        data_atendimento: '2026-04-20',
        horario_escolhido: '2026-04-20T18:00:00.000Z',
        tipo: 'Avaliação',
        nome_completo: 'João Pedro',
        celular: '+5511888888888',
        observacoes_cliente: 'Primeira visita',
      },
      fieldLabelMap: {
        data_atendimento: 'Data do atendimento',
        horario_escolhido: 'Horário',
        tipo: 'Serviço',
        nome_completo: 'Nome do cliente',
        celular: 'Telefone',
        observacoes_cliente: 'Observações',
      },
    })

    expect(fields.selectedDate).toBe('2026-04-20')
    expect(fields.selectedSlot).toBe('2026-04-20T18:00:00.000Z')
    expect(fields.service).toBe('Avaliação')
    expect(fields.customerName).toBe('João Pedro')
    expect(fields.customerPhone).toBe('+5511888888888')
    expect(fields.notes).toBe('Primeira visita')
  })

  it('supports fallback where date is encoded in object key', () => {
    const fields = extractBookingConfirmationFields({
      responseObj: {
        '2026-05-01': 'true',
        slot_escolhido: '2026-05-01T14:15:00.000Z',
      },
      labelsFromConfig: {
        slot_escolhido: 'Horário',
      },
    })

    expect(fields.selectedDate).toBe('2026-05-01')
    expect(fields.selectedSlot).toBe('2026-05-01T14:15:00.000Z')
    expect(fields.service).toBeNull()
  })
})
