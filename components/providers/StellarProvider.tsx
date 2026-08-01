'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    isConnected,
    isAllowed,
    setAllowed,
    getAddress,
    getNetwork,
    signTransaction,
} from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Api as RpcApi, assembleTransaction, Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { useWalletStore, NETWORK_PASSPHRASES, StellarNetwork } from '@/stores/walletStore';
import { WalletErrorOverlay } from './WalletErrorOverlay';
import { createLogger } from '@/lib/logger';
import { startPerformanceMark, endPerformanceMark } from '@/lib/monitoring';
import { categorizeSigningError } from '@/lib/wallet/signingErrors';

// ─── Network Configuration ────────────────────────────────────────────────────

const NETWORK_CONFIG: Record<
    StellarNetwork,
    { horizonUrl: string; sorobanRpcUrl: string }
> = {
    TESTNET: {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    },
    PUBLIC: {
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    },
    FUTURENET: {
        horizonUrl: 'https://horizon-futurenet.stellar.org',
        sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    },
};

const CONFIGURABLE_NETWORKS: StellarNetwork[] = ['TESTNET', 'PUBLIC'];
const DEFAULT_NETWORK: StellarNetwork = 'TESTNET';

const log = createLogger('StellarProvider');

// Resolves the network this app is configured to run against from
// NEXT_PUBLIC_STELLAR_NETWORK. Falls back to TESTNET when the variable is
// unset or holds an unsupported value, so a misconfigured deployment degrades
// to the safest default instead of crashing the client bundle.
function resolveExpectedNetwork(): StellarNetwork {
    const configured = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

    if (configured && CONFIGURABLE_NETWORKS.includes(configured as StellarNetwork)) {
        return configured as StellarNetwork;
    }

    if (configured) {
        log.warn('NEXT_PUBLIC_STELLAR_NETWORK has an unsupported value; defaulting to TESTNET', {
            value: configured,
        });
    }

    return DEFAULT_NETWORK;
}

export const EXPECTED_NETWORK: StellarNetwork = resolveExpectedNetwork();

// ─── Context Types ────────────────────────────────────────────────────────────

interface InvokeContractParams {
    contractId: string;
    method: string;
    args?: StellarSdk.xdr.ScVal[];
}

interface StellarContextValue {
    connect: () => Promise<void>;
    disconnect: () => void;
    signTx: (xdr: string) => Promise<string | null>;
    invokeContract: (params: InvokeContractParams) => Promise<string | null>;
    horizonUrl: string;
    sorobanRpcUrl: string;
    isFreighterInstalled: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const StellarContext = createContext<StellarContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const StellarProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const {
        publicKey,
        isConnected: storeConnected,
        network,
        setPublicKey,
        setConnected,
        setNetwork,
        setLoading,
        setError,
        reset,
    } = useWalletStore();

    const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
    const [overlayState, setOverlayState] = useState<{
        show: boolean;
        type:
            | 'no-wallet'
            | 'wrong-network'
            | 'generic'
            | 'signing-rejected'
            | 'session-expired'
            | 'malformed-tx';
        currentNetwork?: string;
        message?: string;
    }>({ show: false, type: 'generic' });
    // The Retry button on the wallet overlay calls back with no arguments —
    // it closes over the original XDR via signTxRef below so that retrying
    // re-attempts the same envelope. Type the state as a no-arg callback
    // to keep the WalletErrorOverlay `onRetry?: () => void` contract clean.
    const [signRetry, setSignRetry] = useState<null | (() => Promise<string | null>)>(null);

    const initializingRef = useRef(false);

    const networkConfig = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['TESTNET'];
    const isWrongNetwork = network !== EXPECTED_NETWORK;

    // ── Helpers ─────────────────────────────────────────────────────────────

    const showOverlay = useCallback(
        (
            type:
                | 'no-wallet'
                | 'wrong-network'
                | 'generic'
                | 'signing-rejected'
                | 'session-expired'
                | 'malformed-tx',
            extra?: {
                currentNetwork?: string;
                message?: string;
                retry?: (xdr: string) => Promise<string | null>;
                pendingXdr?: string;
            }
        ) => {
            setOverlayState({ show: true, type, ...extra });
        },
        []
    );

    const dismissOverlay = useCallback(() => {
        setOverlayState((prev) => ({ ...prev, show: false }));
        setError(null);
    }, [setError]);

    const syncNetworkFromFreighter = useCallback(async () => {
        try {
            const netObj = await getNetwork();
            if (netObj.error) return;

            const freighterNetwork = netObj.network as StellarNetwork;
            const passphrase = netObj.networkPassphrase;

            setNetwork(freighterNetwork, passphrase);

            if (freighterNetwork !== EXPECTED_NETWORK) {
                showOverlay('wrong-network', {
                    currentNetwork: freighterNetwork,
                });
            }
        } catch {
            // Non-fatal — proceed silently
        }
    }, [setNetwork, showOverlay]);

    useEffect(() => {
        const initialize = async () => {
            if (initializingRef.current) return;
            initializingRef.current = true;

            try {
                setLoading(true);

                const connectionResult = await isConnected();
                const installed = connectionResult.isConnected;
                setIsFreighterInstalled(installed);

                if (!installed) {
                    setConnected(false);
                    setPublicKey(null);
                    return;
                }

                const allowedResult = await isAllowed();
                if (!allowedResult.isAllowed) {
                    setConnected(false);
                    return;
                }

                const addressObj = await getAddress();
                if (addressObj.error || !addressObj.address) {
                    setConnected(false);
                    setPublicKey(null);
                    return;
                }

                setPublicKey(addressObj.address);
                setConnected(true);
                await syncNetworkFromFreighter();
            } catch (err) {
                log.error('Initialization failed', { error: err instanceof Error ? err.message : String(err) });
                setConnected(false);
            } finally {
                setLoading(false);
                initializingRef.current = false;
            }
        };

        initialize();
    }, [setConnected, setLoading, setPublicKey, syncNetworkFromFreighter]);

    useEffect(() => {
        if (!isFreighterInstalled) return;

        const poll = async () => {
            try {
                const addressObj = await getAddress();
                const newKey = addressObj.error ? null : addressObj.address;

                if (newKey !== publicKey) {
                    setPublicKey(newKey);
                    setConnected(!!newKey);
                }

                const netObj = await getNetwork();
                if (!netObj.error) {
                    const newNetwork = netObj.network as StellarNetwork;
                    if (newNetwork !== network) {
                        setNetwork(newNetwork, netObj.networkPassphrase);
                        if (newNetwork !== EXPECTED_NETWORK) {
                            showOverlay('wrong-network', { currentNetwork: newNetwork });
                        } else {
                            dismissOverlay();
                        }
                    }
                }
            } catch {
                // Silent — polling errors are non-fatal
            }
        };

        const interval = setInterval(poll, 2000);
        return () => clearInterval(interval);
    }, [
        isFreighterInstalled,
        publicKey,
        network,
        setPublicKey,
        setConnected,
        setNetwork,
        showOverlay,
        dismissOverlay,
    ]);

    // ── connect() ────────────────────────────────────────────────────────────

    const connect = useCallback(async () => {
        const connectionResult = await isConnected();
        if (!connectionResult.isConnected) {
            showOverlay('no-wallet');
            return;
        }

        try {
            startPerformanceMark('wallet-connect');
            setLoading(true);
            setError(null);

            const allowResult = await setAllowed();
            if (!allowResult.isAllowed) {
                setError('User denied wallet access.');
                return;
            }

            const addressObj = await getAddress();
            if (addressObj.error || !addressObj.address) {
                setError('Could not retrieve public key.');
                return;
            }

            setPublicKey(addressObj.address);
            setConnected(true);
            await syncNetworkFromFreighter();
            endPerformanceMark('wallet-connect');
        } catch (err: unknown) {
            endPerformanceMark('wallet-connect');
            const message = err instanceof Error ? err.message : 'Connection failed.';
            setError(message);
            showOverlay('generic', { message });
        } finally {
            setLoading(false);
        }
    }, [showOverlay, setLoading, setError, setPublicKey, setConnected, syncNetworkFromFreighter]);

    const disconnect = useCallback(() => {
        reset();
    }, [reset]);

    // ── signTx ──────────────────────────────────────────────────────────
    //
    // Signs an XDR envelope with Freighter. On failure, the error message is
    // categorized via `categorizeSigningError` so we can surface the right
    // overlay type (rejected, session-expired, malformed-tx) with matching
    // recovery steps — see WalletErrorOverlay and WALLET_SIGNING_RECOVERY_GUIDE.
    const signTx = useCallback(
        async (xdr: string): Promise<string | null> => {
            const connectionResult = await isConnected();
            if (!connectionResult.isConnected) {
                showOverlay('no-wallet');
                return null;
            }
            if (!storeConnected || !publicKey) {
                setError('Wallet not connected. Please connect first.');
                return null;
            }
            if (isWrongNetwork) {
                showOverlay('wrong-network', { currentNetwork: network });
                return null;
            }

            // Stable retry fn bound to this xdr so Retry from the overlay
            // re-attempts the *same* envelope instead of losing context.
            const retry = async () => signTxRef.current(xdr);
            const routeOverlay = (
                category: ReturnType<typeof categorizeSigningError>['category'],
                rawMessage: string
            ) => {
                log.warn('Wallet signing failed', {
                    category,
                    label: rawMessage,
                });
                setError(rawMessage);
                switch (category) {
                    case 'rejected':
                        setSignRetry(() => retry);
                        showOverlay('signing-rejected', { message: rawMessage });
                        break;
                    case 'expired-session':
                        setSignRetry(() => retry);
                        showOverlay('session-expired', { message: rawMessage });
                        break;
                    case 'malformed-transaction':
                        setSignRetry(() => retry);
                        showOverlay('malformed-tx', { message: rawMessage });
                        break;
                    case 'wrong-network':
                        showOverlay('wrong-network', { currentNetwork: network });
                        break;
                    default:
                        showOverlay('generic', { message: rawMessage });
                }
            };

            try {
                setLoading(true);
                const result = await signTransaction(xdr, {
                    networkPassphrase: NETWORK_PASSPHRASES[network],
                    address: publicKey,
                });

                if (result.error) {
                    const failure = categorizeSigningError(result.error.message);
                    routeOverlay(
                        failure.category,
                        result.error.message ?? 'Transaction signing failed.'
                    );
                    return null;
                }

                return result.signedTxXdr;
            } catch (err: unknown) {
                const failure = categorizeSigningError(err);
                const rawMessage =
                    err instanceof Error ? err.message : 'Signing failed.';
                routeOverlay(failure.category, rawMessage);
                return null;
            } finally {
                setLoading(false);
            }
        },
        // signTxRef.current is kept in sync below, so no need to list `retry`
        // (which closes over signTxRef) here. Listed everything else used.
        [storeConnected, publicKey, network, isWrongNetwork, showOverlay, setLoading, setError]
    );

    // Keep signTxRef pointing at the latest signTx so the retry callback
    // closure inside signTx can re-enter without a stale identity.
    const signTxRef = useRef(signTx);
    useEffect(() => {
        signTxRef.current = signTx;
    }, [signTx]);
    // Note: the `useRef` / `useEffect` pair intentionally lives below signTx
    // so it can reference signTx; the helper above uses signTxRef.current to
    // avoid the chicken-and-egg closure.

    // ── invokeContract() ─────────────────────────────────────────────────────

    const invokeContract = useCallback(
        async ({ contractId, method, args = [] }: InvokeContractParams): Promise<string | null> => {
            if (!storeConnected || !publicKey) {
                setError('Wallet not connected.');
                return null;
            }
            if (isWrongNetwork) {
                showOverlay('wrong-network', { currentNetwork: network });
                return null;
            }

            try {
                setLoading(true);

                const server = new SorobanServer(networkConfig.sorobanRpcUrl);
                const sourceAccount = await server.getAccount(publicKey);
                const contract = new StellarSdk.Contract(contractId);

                const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                    fee: StellarSdk.BASE_FEE,
                    networkPassphrase: NETWORK_PASSPHRASES[network],
                })
                    .addOperation(contract.call(method, ...args))
                    .setTimeout(30)
                    .build();

                const simResult = await server.simulateTransaction(transaction);
                if (RpcApi.isSimulationError(simResult)) {
                    setError(`Simulation failed: ${simResult.error}`);
                    return null;
                }

                const preparedTx = assembleTransaction(transaction, simResult).build();

                const signedXdr = await signTx(preparedTx.toXDR());
                if (!signedXdr) return null;

                const submitResult = await server.sendTransaction(
                    StellarSdk.TransactionBuilder.fromXDR(
                        signedXdr,
                        NETWORK_PASSPHRASES[network]
                    )
                );

                return submitResult.hash;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Contract invocation failed.';
                setError(message);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [storeConnected, publicKey, network, isWrongNetwork, networkConfig, signTx, showOverlay, setLoading, setError]
    );

    // ── Context value ────────────────────────────────────────────────────────

    const value: StellarContextValue = {
        connect,
        disconnect,
        signTx,
        invokeContract,
        horizonUrl: networkConfig.horizonUrl,
        sorobanRpcUrl: networkConfig.sorobanRpcUrl,
        isFreighterInstalled,
    };

    return (
        <StellarContext.Provider value={value}>
            {children}
            {overlayState.show && (
                <WalletErrorOverlay
                    type={overlayState.type}
                    currentNetwork={overlayState.currentNetwork}
                    expectedNetwork={EXPECTED_NETWORK}
                    message={overlayState.message}
                    onDismiss={dismissOverlay}
                    onRetry={signRetry ?? undefined}
                />
            )}
        </StellarContext.Provider>
    );
};

// ─── Custom Hook ──────────────────────────────────────────────────────────────

export const useStellar = (): StellarContextValue => {
    const context = useContext(StellarContext);
    if (!context) {
        throw new Error('useStellar must be used within a <StellarProvider>');
    }
    return context;
};

export const useOptionalStellar = (): StellarContextValue | null => {
    return useContext(StellarContext);
};