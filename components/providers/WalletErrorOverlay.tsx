'use client';

import React from 'react';

interface WalletErrorOverlayProps {
    type: 'no-wallet' | 'wrong-network' | 'generic';
    message?: string;
    onDismiss?: () => void;
    expectedNetwork?: string;
    currentNetwork?: string;
}

export const WalletErrorOverlay: React.FC<WalletErrorOverlayProps> = ({
    type,
    message,
    onDismiss,
    expectedNetwork,
    currentNetwork,
}) => {
    const content = {
        'no-wallet': {
            title: '🔌 Freighter Wallet Not Found',
            description:
                'The Freighter browser extension is required to interact with the Stellar network.',
            action: (
                <a
                    href="https://www.freighter.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                    Install Freighter →
                </a >
            ),
        },
        'wrong-network': {
            title: '⚠️ Wrong Network',
            description: `Your wallet is on ${currentNetwork ?? 'an unknown network'}, but this app requires ${expectedNetwork ?? 'a different network'}. Please switch networks in your Freighter extension.`,
            action: null,
        },
        generic: {
            title: '❌ Wallet Error',
            description: message ?? 'An unexpected wallet error occurred.',
            action: null,
        },
    }[type];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {content.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    {content.description}
                </p>
                {content.action}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="mt-4 block mx-auto text-xs text-gray-400 underline hover:text-gray-600"
                    >
                        Dismiss
                    </button>
                )}
            </div>
        </div>
    );
};