'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Página temporária para pular o onboarding sem precisar do console.
 * Útil para acesso via mobile. Pode ser removida após configurar o WhatsApp.
 */
export default function SkipOnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/settings/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingCompleted: true }),
    })
      .then((r) => {
        if (r.ok) {
          setStatus('done');
          setTimeout(() => router.push('/'), 1500);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="text-center space-y-3">
        {status === 'loading' && <p className="text-zinc-400">Pulando onboarding...</p>}
        {status === 'done' && (
          <>
            <p className="text-emerald-400 text-lg font-semibold">Pronto!</p>
            <p className="text-zinc-400 text-sm">Redirecionando para o dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <p className="text-red-400">Erro ao pular onboarding. Tente novamente.</p>
        )}
      </div>
    </div>
  );
}
