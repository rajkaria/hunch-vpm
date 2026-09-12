'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { useNetwork } from './network';

export interface WalletState {
  /** The connected address, or null. */
  address: `0x${string}` | null;
  /** Connected AND on the chain this deployment transacts on. */
  ready: boolean;
  /** Connected but on some other chain. The one state that needs a prompt. */
  wrongChain: boolean;
  connecting: boolean;
  switching: boolean;
  /**
   * Connectors that can actually be used right now — not merely registered.
   * wagmi always lists `injected` whether or not a provider exists, and
   * offering it to a browser with no wallet produces a button that does
   * nothing when clicked, which is the worst outcome available.
   */
  connectors: { id: string; name: string; connect: () => void }[];
  /** True when no connector can be used: no injected provider, no WalletConnect. */
  noWallet: boolean;
  disconnect: () => void;
  /** Ask the wallet to switch to — or add — the selected chain. */
  switchToActive: () => void;
  error: string | null;
  chainName: string;
  /** The chain id the surface is pointed at, which is the viewer's choice. */
  chainId: number;
}

/**
 * One place the whole app reads wallet state from.
 *
 * The distinction that matters here is `ready` versus `wrongChain`. Arc's chain
 * id ships in no wallet, so "connected" is never sufficient on its own — a user
 * is far more likely to arrive connected-but-elsewhere than to arrive correct,
 * and a surface that treats those two as the same state will happily offer to
 * send an approval to whatever token sits at that address on mainnet.
 */
export function useWallet(): WalletState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();

  /*
   * Whether the browser actually has an injected provider. Resolved after mount
   * rather than during render: `window` does not exist on the server, and an
   * extension can inject late enough to miss the first paint, so this re-checks
   * on `eip6963:announceProvider` too.
   */
  const [injectedReady, setInjectedReady] = useState(false);
  useEffect(() => {
    const look = () => {
      if (typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum != null) {
        setInjectedReady(true);
      }
    };
    look();
    window.addEventListener('eip6963:announceProvider', look);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', look);
  }, []);

  const { chain: selected, facts } = useNetwork();

  const switchToActive = useCallback(() => {
    switchChain({ chainId: selected.id });
  }, [switchChain, selected.id]);

  const list = useMemo(
    () =>
      usableConnectors(connectors, injectedReady).map((connector) => ({
        id: connector.id,
        name: connector.label,
        connect: () => connect({ connector: connector.source }),
      })),
    [connectors, connect, injectedReady],
  );

  const onActive = isConnected && chainId === selected.id;

  return {
    address: isConnected && address !== undefined ? address : null,
    ready: onActive,
    wrongChain: isConnected && !onActive,
    connecting,
    switching,
    connectors: list,
    noWallet: list.length === 0,
    disconnect: () => disconnect(),
    switchToActive,
    error: connectError?.message ?? switchError?.message ?? null,
    chainName: facts.name,
    chainId: selected.id,
  };
}

/**
 * Which registered connectors a visitor can actually use.
 *
 * wagmi lists `injected` whether or not the browser has a provider, so a
 * visitor with no wallet is offered a button that does nothing when clicked.
 * Dropping it here is what lets the UI say "no wallet found" instead.
 *
 * Pure and exported so the rule is testable without a browser or a wallet.
 */
export function usableConnectors<T extends { id: string; name: string }>(
  connectors: readonly T[],
  injectedReady: boolean,
): { id: string; label: string; source: T }[] {
  return connectors
    .filter((connector) => connector.id !== 'injected' || injectedReady)
    .map((connector) => ({
      id: connector.id,
      // "Browser wallet" rather than whatever the extension calls itself, so the
      // menu reads consistently whichever wallet is installed.
      label: connector.id === 'injected' ? 'Browser wallet' : connector.name,
      source: connector,
    }));
}

/** `0x1234…abcd`, which is how the product writes an address everywhere else. */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
