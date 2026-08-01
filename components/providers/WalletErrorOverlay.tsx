'use client';

import React from 'react';
import { useHelpDrawer, HELP_CONTENT } from '@/stores/helpDrawer';

interface WalletErrorOverlayProps {
    type:
        | 'no-wallet'
        | 'wrong-network'
        | 'generic'
        | 'signing-rejected'
        | 'session-expired'
        | 'malformed-tx';
    message?: string;
    onDismiss?: () => void;
    onRetry?: () => void;
    expectedNetwork?: string;
    currentNetwork?: string;
}

export const WalletErrorOverlay: React.FC<WalletErrorOverlayProps> = ({
    type,
    message,
    onDismiss,
    onRetry,
    expectedNetwork,
    currentNetwork,
}) => {
    const { openHelp } = useHelpDrawer();

    const openRecoveryGuide = () => {
        const content = HELP_CONTENT['wallet-signing'];
        if (content) openHelp('wallet-signing', content);
    };

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
            retryable: false,
        },
        'wrong-network': {
            title: '⚠️ Wrong Network',
            description: `Your wallet is on ${currentNetwork ?? 'an unknown network'}, but this app requires ${expectedNetwork ?? 'a different network'}. Please switch networks in your Freighter extension.`,
            action: (
                <ol className="text-sm text-left text-gray-600 dark:text-gray-400 mt-3 space-y-1 list-decimal list-inside">
                    <li>Open your Freighter extension</li>
                    <li>Go to Settings → Network</li>
                    <li>Select <strong>{expectedNetwork}</strong></li>
                    <li>Return to the application. The network will be detected automatically.</li>
                </ol>
            ),
            retryable: false,
        },
        'signing-rejected': {
            title: '🚫 Transaction Rejected',
            description:
                'The signing request was declined or cancelled in Freighter. No transaction was submitted and no funds were moved.',
            action: (
                <div className="text-sm text-left text-gray-600 dark:text-gray-400 mt-3 space-y-2">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                        How to recover:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Verify the amount, recipient, and memo on the dashboard</li>
                        <li>Click <strong>Retry</strong> to re-send the request</li>
                        <li>In Freighter, click <strong>Approve</strong> (do not close the popup)</li>
                    </ol>
                </div>
            ),
            retryable: true,
        },
        'session-expired': {
            title: '🔒 Session Expired',
            description:
                'Freighter is locked or the dashboard access grant has expired. The wallet refused to sign without re-authentication.',
            action: (
                <div className="text-sm text-left text-gray-600 dark:text-gray-400 mt-3 space-y-2">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                        How to recover:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Open Freighter and unlock it with your password</li>
                        <li>Re-connect from the header <strong>Connect Wallet</strong> button</li>
                        <li>Confirm the account and network still match expectations</li>
                        <li>Click <strong>Retry</strong> on the original action</li>
                    </ol>
                </div>
            ),
            retryable: true,
        },
        'malformed-tx': {
            title: '🔧 Invalid Transaction Data',
            description:
                message ??
                'The transaction envelope could not be decoded. This usually indicates stale browser state, an SDK mismatch, or a server-side data issue.',
            action: (
                <div className="text-sm text-left text-gray-600 dark:text-gray-400 mt-3 space-y-2">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                        How to recover:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Do not retry blindly — the same envelope will fail again</li>
                        <li>Hard-refresh the dashboard (Cmd/Ctrl + Shift + R)</li>
                        <li>Try the action again in a private/incognito window</li>
                        <li>If the failure persists, escalate with the captured error and run ID</li>
                    </ol>
                </div>
            ),
            retryable: true,
        },
        generic: {
            title: '❌ Wallet Error',
            description: message ?? 'An unexpected wallet error occurred.',
            action: null,
            retryable: true,
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
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
                    {content.retryable && onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                        >
                            Retry
                        </button>
                    )}
                    <button
                        onClick={openRecoveryGuide}
                        className="px-4 py-2 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 underline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                    >
                        View full recovery guide
                    </button>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="mt-3 block mx-auto text-xs text-gray-400 underline hover:text-gray-600"
                    >
                        Dismiss
                    </button>
                )}
            </div>
        </div>
    );
};
