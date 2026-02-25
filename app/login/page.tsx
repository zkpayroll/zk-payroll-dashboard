'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStellar } from '@/components/providers/StellarProvider';
import { useWalletStore } from '@/stores/walletStore';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connect, isFreighterInstalled } = useStellar();
  const { publicKey, isConnected, isLoading } = useWalletStore();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    if (!isConnected || !publicKey) return;

    async function createSession() {
      setIsCreatingSession(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create session');
        }

        router.push(redirect);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session creation failed');
      } finally {
        setIsCreatingSession(false);
      }
    }

    createSession();
  }, [isConnected, publicKey, redirect, router]);

  const handleConnect = async () => {
    setError(null);
    await connect();
  };

  const loading = isLoading || isCreatingSession;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          ZK Payroll Dashboard
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          Connect your Stellar wallet to continue
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Connecting...'
            : isConnected
              ? 'Creating session...'
              : 'Connect Wallet'}
        </button>

        {!isFreighterInstalled && (
          <p className="mt-4 text-center text-xs text-gray-400">
            Freighter wallet extension is required.{' '}
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Install Freighter
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
