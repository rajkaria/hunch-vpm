'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { NETWORKS, type ContractAddresses, type ChainFacts, type NetworkId } from '@/lib/chain';
import { CHAINS, DEFAULT_NETWORK } from './chains';

/**
 * Which Arc this surface is pointed at, chosen by the viewer rather than baked
 * into the build.
 *
 * The choice is deliberate and sticky, never inferred from the wallet. A venue
 * that quietly follows whatever chain a wallet happens to be on is a venue that
 * will eventually send an approval to the wrong USDC — so the viewer picks,
 * the pick is remembered, and a wallet that disagrees is a *wrong chain* state
 * with a prompt rather than a silent switch.
 */

interface NetworkContextValue {
  network: NetworkId;
  setNetwork: (network: NetworkId) => void;
  facts: ChainFacts;
  addresses: ContractAddresses;
  chain: (typeof CHAINS)[NetworkId];
  /** True once the stored choice has been read, so nothing renders the wrong one first. */
  hydrated: boolean;
}

const STORAGE_KEY = 'hunch-vpm.network';

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setStored] = useState<NetworkId>(DEFAULT_NETWORK);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount: the server has no localStorage, and rendering the stored
  // choice during SSR would be a hydration mismatch on the most important
  // control on the page.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'mainnet' || saved === 'testnet') setStored(saved);
    } catch {
      // Private mode, or storage disabled. The default is a fine answer.
    }
    setHydrated(true);
  }, []);

  const setNetwork = useCallback((next: NetworkId) => {
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembering the choice is survivable; refusing to make it is not.
    }
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      setNetwork,
      facts: NETWORKS[network].facts,
      addresses: NETWORKS[network].addresses,
      chain: CHAINS[network],
      hydrated,
    }),
    [network, setNetwork, hydrated],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (value === null) {
    throw new Error('useNetwork must be used inside <NetworkProvider>');
  }
  return value;
}
