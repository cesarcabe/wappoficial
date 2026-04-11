'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Plus, Trash2, ArrowRight, RefreshCw, CloudDownload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Container } from '@/components/ui/container'
import { StatusBadge } from '@/components/ui/status-badge'
import { CreateFlowFromTemplateDialog } from '@/components/features/flows/builder/CreateFlowFromTemplateDialog'
import type { FlowRow } from '@/services/flowsService'

// Lazy load AI dialog (~50-80KB reduction - AI dependencies)
const CreateFlowWithAIDialog = dynamic(
  () => import('@/components/features/flows/builder/CreateFlowWithAIDialog').then(m => ({ default: m.CreateFlowWithAIDialog })),
  { loading: () => null }
)

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR')
}

export function FlowBuilderListView(props: {
  flows: FlowRow[]
  isLoading: boolean
  isFetching: boolean
  search: string
  onSearchChange: (v: string) => void
  onCreate: (name: string) => Promise<FlowRow | void>
  onCreateFromTemplate: (input: { name: string; templateKey: string }) => Promise<FlowRow | void>
  onCreateWithAI: (input: { name: string; prompt: string }) => Promise<FlowRow | void>
  isCreating: boolean
  isCreatingWithAI: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
  onRefresh: () => void
  onSyncFromMeta: () => void
  isSyncing: boolean
}) {
  const router = useRouter()
  const [newName, setNewName] = useState('')

  const canCreate = useMemo(() => newName.trim().length >= 3, [newName])

  return (
    <div className="space-y-6">
      <Container variant="glass" padding="lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Buscar</label>
              <Input
                value={props.search}
                onChange={(e) => props.onSearchChange(e.target.value)}
                placeholder="Nome ou ID da MiniApp (Meta)"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Criar nova MiniApp</label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: onboarding_lead"
                />
                <Button
                  type="button"
                  onClick={async () => {
                    const n = newName.trim()
                    if (!n) return
                    try {
                      const created = await props.onCreate(n)
                      if (created?.id) {
                        setNewName('')
                        router.push(`/flows/builder/${encodeURIComponent(created.id)}`)
                      }
                    } catch {
                      // Errors handled by mutation toasts.
                    }
                  }}
                  disabled={!canCreate || props.isCreating}
                >
                  <Plus size={16} />
                  Criar
                </Button>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Sugestão: use nomes curtos e consistentes (ex.: snake_case).</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CreateFlowWithAIDialog
              isCreating={props.isCreatingWithAI}
              onCreate={async (input) => {
                const created = await props.onCreateWithAI(input)
                if (created?.id) {
                  router.push(`/flows/builder/${encodeURIComponent(created.id)}`)
                }
              }}
            />
            <CreateFlowFromTemplateDialog
              isCreating={props.isCreating}
              onCreate={async (input) => {
                const created = await props.onCreateFromTemplate(input)
                if (created?.id) {
                  router.push(`/flows/builder/${encodeURIComponent(created.id)}`)
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="bg-zinc-950/40 border border-white/10 text-gray-200 hover:text-white hover:bg-white/5"
              onClick={props.onSyncFromMeta}
              disabled={props.isSyncing || props.isLoading}
              title="Importa flows publicados na Meta que ainda não existem no app"
            >
              <CloudDownload size={16} className={props.isSyncing ? 'animate-pulse' : ''} />
              {props.isSyncing ? 'Sincronizando…' : 'Sincronizar Meta'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-zinc-950/40 border border-white/10 text-gray-200 hover:text-white hover:bg-white/5"
              onClick={props.onRefresh}
              disabled={props.isLoading || props.isFetching}
            >
              <RefreshCw size={16} className={props.isFetching ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          {props.isLoading ? 'Carregando…' : `Mostrando ${props.flows.length} MiniApp(s)`}
          {props.isFetching && !props.isLoading ? ' (atualizando…)': ''}
        </div>
      </Container>

      <Container variant="glass" padding="none" className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950/40">
            <tr className="text-gray-300">
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">ID da MiniApp (Meta)</th>
              <th className="px-4 py-3 font-semibold">Criado</th>
              <th className="px-4 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {props.flows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  Nenhum MiniApp ainda. Crie um para abrir o editor visual.
                </td>
              </tr>
            ) : (
              props.flows.map((f) => (
                <tr key={f.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 text-gray-200 font-medium">{f.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={f.status === 'published' ? 'success' : f.status === 'draft' ? 'draft' : 'default'}
                      size="sm"
                    >
                      {f.status === 'published' ? 'Publicado' : f.status === 'draft' ? 'Rascunho' : f.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{f.meta_flow_id || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDateTime(f.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/flows/builder/${encodeURIComponent(f.id)}`}>
                        <Button type="button" variant="secondary" className="bg-zinc-950/40 border border-white/10 text-gray-200 hover:text-white hover:bg-white/5">
                          Abrir
                          <ArrowRight size={16} />
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost-destructive"
                        size="icon"
                        onClick={() => props.onDelete(f.id)}
                        disabled={props.isDeleting}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Container>
    </div>
  )
}
