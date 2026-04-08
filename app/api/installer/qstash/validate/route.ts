import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/installer/qstash/validate
 *
 * Valida o token do QStash fazendo uma request à API.
 * Usado no step 4 do wizard de instalação.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    // Validação básica
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token QStash é obrigatório' },
        { status: 400 }
      );
    }

    // Valida o token tentando múltiplas regiões do QStash (US e EU)
    const QSTASH_REGIONS = [
      'https://qstash.upstash.io',
      'https://qstash-us-east-1.upstash.io',
      'https://qstash-eu-west-1.upstash.io',
      'https://qstash-eu-central-1.upstash.io',
    ];

    let lastStatus = 0;
    let lastError = '';

    for (const baseUrl of QSTASH_REGIONS) {
      const qstashRes = await fetch(`${baseUrl}/v2/schedules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (qstashRes.ok) {
        // Token válido nesta região
        return NextResponse.json({ valid: true, message: 'Token QStash válido', qstashUrl: baseUrl });
      }

      if (qstashRes.status === 401 || qstashRes.status === 403) {
        // Credencial definitivamente inválida — não adianta tentar outras regiões
        return NextResponse.json(
          { error: 'Token QStash inválido. Verifique o QSTASH_TOKEN na aba Details do Upstash.' },
          { status: 401 }
        );
      }

      // 404 com "not found in this region" → tenta próxima região
      const body = await qstashRes.text().catch(() => '');
      lastStatus = qstashRes.status;
      lastError = body || qstashRes.statusText;
    }

    return NextResponse.json(
      { error: `Erro ao validar token: ${lastError}` },
      { status: lastStatus || 502 }
    );

  } catch (error) {
    console.error('[installer/qstash/validate] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao validar token' },
      { status: 500 }
    );
  }
}
