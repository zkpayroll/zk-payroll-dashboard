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
import { useEnvironmentStore } from '@/stores/environment';
import { WalletErrorOverlay } from './WalletErrorOverlay';
import { createLogger } from '@/lib/logger';
import { startPerformanceMark, endPerformanceMark } from '@/lib/monitoring';
import { categorizeSigningError } from '@/lib/wallet/signingErrors';
import { useSigningFailuresStore, type RecoverableSigningCategory } from '@/stores/signingFailures';

const log = createLogger('StellarProvider');

const FALLBACK_NETWORK_CONFIG: Record<
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
    expectedNetwork: StellarNetwork;
    isWrongNetwork: boolean;
}

const StellarContext = createContext<StellarContextValue | null>(null);

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

    const {
        getActiveProfileConfig,
        setConnectionStatus,
    } = useEnvironmentStore();

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
    const [signRetry, setSignRetry] = useState<null | (() => Promise<string | null>)>(null);
    const [expectedNetwork, setExpectedNetwork] = useState<StellarNetwork>('TESTNET');
    const [networkConfig, setNetworkConfig] = useState({ horizonUrl: '', sorobanRpcUrl: '' });

    const initializingRef = useRef(false);

    const isWrongNetwork = network !== expectedNetwork;

    useEffect(() => {
        const profile = getActiveProfileConfig();
        setExpectedNetwork(profile.stellarNetwork);
        setNetworkConfig({
            horizonUrl: profile.horizonUrl,
            sorobanRpcUrl: profile.sorobanRpcUrl,
        });
    }, [getActiveProfileConfig]);

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

            if (freighterNetwork !== expectedNetwork) {
                showOverlay('wrong-network', {
                    currentNetwork: freighterNetwork,
                });
            } else {
                dismissOverlay();
            }
        } catch {
            // Non-fatal — proceed silently
        }
    }, [setNetwork, showOverlay, dismissOverlay, expectedNetwork]);

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
                        if (newNetwork !== expectedNetwork) {
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
        expectedNetwork,
        setPublicKey,
        setConnected,
        setNetwork,
        showOverlay,
        dismissOverlay,
    ]);

    const checkRpcConnection = useCallback(async () => {
        try {
            const response = await fetch(`${networkConfig.sorobanRpcUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            }).catch(() => null);
            setConnectionStatus(response?.ok ? 'connected' : 'disconnected');
        } catch {
            setConnectionStatus('disconnected');
        }
    }, [networkConfig.sorobanRpcUrl, setConnectionStatus]);

    useEffect(() => {
        checkRpcConnection();
        const interval = setInterval(checkRpcConnection, 30000);
        return () => clearInterval(interval);
    }, [checkRpcConnection]);

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
                if (category !== 'wrong-network') {
                    useSigningFailuresStore.getState().recordFailure({
                        category: category as RecoverableSigningCategory,
                        message: rawMessage,
                    });
                }
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
        [storeConnected, publicKey, network, isWrongNetwork, showOverlay, setLoading, setError]
    );

    const signTxRef = useRef(signTx);
    useEffect(() => {
        signTxRef.current = signTx;
    }, [signTx]);

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

    const value: StellarContextValue = {
        connect,
        disconnect,
        signTx,
        invokeContract,
        horizonUrl: networkConfig.horizonUrl,
        sorobanRpcUrl: networkConfig.sorobanRpcUrl,
        isFreighterInstalled,
        expectedNetwork,
        isWrongNetwork,
    };

    return (
        <StellarContext.Provider value={value}>
            {children}
            {overlayState.show && (
                <WalletErrorOverlay
                    type={overlayState.type}
                    currentNetwork={overlayState.currentNetwork}
                    expectedNetwork={expectedNetwork}
                    message={overlayState.message}
                    onDismiss={dismissOverlay}
                    onRetry={signRetry ?? undefined}
                />
            )}
        </StellarContext.Provider>
    );
};

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