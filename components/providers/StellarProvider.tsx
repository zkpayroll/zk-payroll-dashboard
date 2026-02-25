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

const EXPECTED_NETWORK: StellarNetwork = 'TESTNET';

const log = createLogger('StellarProvider');

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
        type: 'no-wallet' | 'wrong-network' | 'generic';
        currentNetwork?: string;
        message?: string;
    }>({ show: false, type: 'generic' });

    const initializingRef = useRef(false);

    const networkConfig = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['TESTNET'];

    // ── Helpers ─────────────────────────────────────────────────────────────

    const showOverlay = useCallback(
        (
            type: 'no-wallet' | 'wrong-network' | 'generic',
            extra?: { currentNetwork?: string; message?: string }
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
    }, []);

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

            try {
                setLoading(true);
                const result = await signTransaction(xdr, {
                    networkPassphrase: NETWORK_PASSPHRASES[network],
                    address: publicKey,
                });

                if (result.error) {
                    setError(result.error.message ?? 'Transaction signing failed.');
                    return null;
                }

                return result.signedTxXdr;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Signing failed.';
                setError(message);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [storeConnected, publicKey, network, showOverlay, setLoading, setError]
    );

    // ── invokeContract() ─────────────────────────────────────────────────────

    const invokeContract = useCallback(
        async ({ contractId, method, args = [] }: InvokeContractParams): Promise<string | null> => {
            if (!storeConnected || !publicKey) {
                setError('Wallet not connected.');
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
        [storeConnected, publicKey, network, networkConfig, signTx, setLoading, setError]
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