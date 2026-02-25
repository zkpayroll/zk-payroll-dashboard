'use client';

import React from 'react';
import { useStellar } from '@/components/providers/StellarProvider';
import { useWalletStore } from '@/stores/walletStore';

export const StellarDebugPanel: React.FC = () => {
    const { horizonUrl, sorobanRpcUrl, isFreighterInstalled, connect, disconnect } =
        useStellar();
    const { publicKey, isConnected, network, isLoading, error } = useWalletStore();

    return (
        <div className="fixed bottom-4 right-4 z-40 bg-gray-950 text-green-400 font-mono text-xs rounded-xl p-4 w-80 shadow-2xl border border-gray-800">
            <p className="text-gray-400 uppercase tracking-widest text-[10px] mb-3">
                🛰 Stellar Debug Panel
            </p>
            <div className="space-y-1">
                <Row label="Freighter" value={isFreighterInstalled ? '✅ Installed' : '❌ Not Found'} />
                <Row label="Status" value={isConnected ? '🟢 Connected' : '🔴 Disconnected'} />
                <Row label="Network" value={network} />
                <Row label="Loading" value={String(isLoading)} />
                <Row label="Public Key" value={publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-4)}` : '—'} />
                <Row label="Horizon URL" value={horizonUrl} />
                <Row label="Soroban RPC" value={sorobanRpcUrl} />
                {error && <Row label="Error" value={error} valueClass="text-red-400" />}
            </div>
            <div className="mt-3 flex gap-2">
                <button
                    onClick={connect}
                    className="flex-1 bg-blue-700 hover:bg-blue-600 text-white rounded px-2 py-1 text-xs"
                >
                    Connect
                </button>
                <button
                    onClick={disconnect}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded px-2 py-1 text-xs"
                >
                    Disconnect
                </button>
            </div>
        </div>
    );
};

const Row = ({
    label,
    value,
    valueClass = 'text-green-300',
}: {
    label: string;
    value: string;
    valueClass?: string;
}) => (
    <div className="flex justify-between gap-2">
        <span className="text-gray-500">{label}:</span>
        <span className={`truncate text-right ${valueClass}`}>{value}</span>
    </div>
);