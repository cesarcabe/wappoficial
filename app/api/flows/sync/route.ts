import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '@/lib/supabase'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { metaListFlows } from '@/lib/meta-flows-api'
import { MetaGraphApiError } from '@/lib/meta-flows-api'

/**
 * POST /api/flows/sync
 *
 * Busca todos os Flows da WABA na Meta e importa para o banco local
 * os que ainda não existem (identificados pelo meta_flow_id).
 * Flows já existentes no banco não são modificados.
 *
 * Retorna:
 *   { imported: number, skipped: number, total: number, flows: FlowRow[] }
 */
export async function POST() {
  try {
    const credentials = await getWhatsAppCredentials()
    if (!credentials?.accessToken || !credentials.businessAccountId) {
      return NextResponse.json(
        { error: 'WhatsApp não configurado. Defina Access Token e WABA ID nas Configurações.' },
        { status: 400 }
      )
    }

    // 1. Buscar flows da Meta
    const metaFlows = await metaListFlows({
      accessToken: credentials.accessToken,
      wabaId: credentials.businessAccountId,
    })

    if (metaFlows.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, total: 0, flows: [] })
    }

    // 2. Buscar meta_flow_ids já cadastrados no banco
    const { data: existing, error: existingErr } = await supabase
      .from('flows')
      .select('meta_flow_id')
      .not('meta_flow_id', 'is', null)

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message || 'Falha ao buscar flows locais' }, { status: 500 })
    }

    const existingMetaIds = new Set(
      (existing || []).map((r: any) => String(r.meta_flow_id || '')).filter(Boolean)
    )

    // 3. Filtrar apenas os que ainda não existem localmente
    const toImport = metaFlows.filter((f) => f.id && !existingMetaIds.has(f.id))

    if (toImport.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: metaFlows.length,
        total: metaFlows.length,
        flows: [],
      })
    }

    // 4. Inserir novos flows
    const now = new Date().toISOString()
    const rows = toImport.map((f) => ({
      name: f.name || `Flow ${f.id}`,
      status: f.status === 'PUBLISHED' ? 'published' : 'draft',
      meta_flow_id: f.id,
      meta_status: f.status || null,
      meta_last_checked_at: now,
      ...(f.status === 'PUBLISHED' ? { meta_published_at: now } : {}),
      spec: {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        form: {
          version: 1,
          screenId: 'FORM',
          title: f.name || `Flow ${f.id}`,
          intro: '',
          submitLabel: 'Enviar',
          fields: [],
        },
        nodes: [{ id: 'start', type: 'start', position: { x: 80, y: 120 }, data: { label: 'Início' } }],
        edges: [],
      },
      created_at: now,
      updated_at: now,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('flows')
      .insert(rows)
      .select('*')

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message || 'Falha ao importar flows' }, { status: 500 })
    }

    return NextResponse.json({
      imported: (inserted || []).length,
      skipped: metaFlows.length - toImport.length,
      total: metaFlows.length,
      flows: inserted || [],
    })
  } catch (error) {
    if (error instanceof MetaGraphApiError) {
      return NextResponse.json(
        { error: error.message || 'Falha ao comunicar com a Meta' },
        { status: 400 }
      )
    }
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
