import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  fetchGoogleAccountEmail,
  saveTokens,
  buildDefaultCalendarConfig,
  saveCalendarConfig,
  ensureCalendarChannel,
} from '@/lib/google-calendar'

const STATE_COOKIE = 'gc_oauth_state'
const RETURN_COOKIE = 'gc_oauth_return'

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const cookieState = request.cookies.get(STATE_COOKIE)?.value
    const returnTo = request.cookies.get(RETURN_COOKIE)?.value || '/settings'

    if (!code) {
      return NextResponse.json({ error: 'Codigo OAuth ausente' }, { status: 400 })
    }
    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json({ error: 'Estado OAuth invalido' }, { status: 400 })
    }

    const tokens = await exchangeCodeForTokens(code)
    console.log('[google-calendar] callback: tokens obtidos, salvando...')
    await saveTokens(tokens)
    console.log('[google-calendar] callback: tokens salvos no Supabase + cache Redis')

    const accountEmail = await fetchGoogleAccountEmail(tokens.accessToken)
    console.log('[google-calendar] callback: email obtido:', accountEmail)

    // Passa os tokens em memória por toda a cadeia (buildDefaultCalendarConfig →
    // listCalendars → ensureCalendarChannel → createWatchChannel). Isso desacopla
    // completamente o fluxo OAuth de qualquer leitura de Redis/Supabase logo após
    // saveTokens(), eliminando race conditions de cache.
    const config = await buildDefaultCalendarConfig(accountEmail, tokens)
    console.log('[google-calendar] callback: config built, calendarId:', config.calendarId)
    await saveCalendarConfig(config)

    await ensureCalendarChannel(config.calendarId, tokens)
    console.log('[google-calendar] callback: channel garantido')

    // Forçar path local — nunca permitir URLs absolutas (previne open redirect)
    const safePath = returnTo.startsWith('/') ? returnTo : '/settings'
    const absoluteReturnUrl = `${url.origin}${safePath}`

    const response = NextResponse.redirect(absoluteReturnUrl)
    response.cookies.delete(STATE_COOKIE)
    response.cookies.delete(RETURN_COOKIE)
    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[google-calendar] callback error:', errorMessage, error)
    return NextResponse.json({
      error: 'Falha ao concluir OAuth',
      details: errorMessage
    }, { status: 500 })
  }
}
