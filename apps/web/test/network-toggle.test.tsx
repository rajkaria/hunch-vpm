import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const wagmi = vi.hoisted(() => ({ chainId: 5042002 }));
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => wagmi.chainId,
  useConnect: () => ({ connect: () => {}, connectors: [], isPending: false, error: null }),
  useDisconnect: () => ({ disconnect: () => {} }),
  useSwitchChain: () => ({ switchChain: () => {}, isPending: false, error: null }),
}));

import { ARC_MAINNET, ARC_MAINNET_ADDRESSES, ARC_TESTNET, NETWORKS, isDeployed, networkForChainId } from '@/lib/chain';
import { MainnetNotice } from '@/components/wallet/MainnetNotice';
import { NetworkToggle } from '@/components/wallet/NetworkToggle';
import { NetworkProvider } from '@/lib/wallet/network';
import { CHAINS, DEFAULT_NETWORK } from '@/lib/wallet/chains';
import { WALLETCONNECT_PROJECT_ID } from '@/lib/wallet/config';

const wrap = (ui: React.ReactNode) => render(<NetworkProvider>{ui}</NetworkProvider>);

beforeEach(() => window.localStorage.clear());

describe('the network registry', () => {
  it('carries both Arcs, at the right chain ids', () => {
    expect(NETWORKS.testnet.facts.id).toBe(5042002);
    expect(NETWORKS.mainnet.facts.id).toBe(5042);
    expect(CHAINS.testnet.id).toBe(ARC_TESTNET.id);
    expect(CHAINS.mainnet.id).toBe(ARC_MAINNET.id);
  });

  it('keeps USDC as the native gas token at six decimals on BOTH chains', () => {
    // Wrong on either chain and every gas estimate is out by twelve orders.
    for (const chain of [CHAINS.testnet, CHAINS.mainnet]) {
      expect(chain.nativeCurrency.symbol).toBe('USDC');
      expect(chain.nativeCurrency.decimals).toBe(6);
    }
  });

  it('maps a chain id back to a network, and refuses anything else', () => {
    expect(networkForChainId(5042002)).toBe('testnet');
    expect(networkForChainId(5042)).toBe('mainnet');
    expect(networkForChainId(1)).toBeNull();
    expect(networkForChainId(8453)).toBeNull();
  });

  it('holds no mainnet address of ours, because nothing is deployed there', () => {
    // Including the ERC-8004 registries: those have published TESTNET addresses
    // and no verified mainnet one, and guessing would point /agents at whatever
    // happens to sit at that address.
    for (const [name, address] of Object.entries(ARC_MAINNET_ADDRESSES)) {
      if (name === 'usdc') continue; // native gas predeploy, same on both
      expect(isDeployed(address), `${name} must stay a placeholder`).toBe(false);
    }
  });

  it('defaults to testnet, so a misconfigured build cannot land someone on mainnet', () => {
    expect(DEFAULT_NETWORK).toBe('testnet');
  });
});

describe('WalletConnect', () => {
  it('ships the parent product’s project id, which is public by design', () => {
    expect(WALLETCONNECT_PROJECT_ID).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('NetworkToggle', () => {
  it('offers both networks and starts on the default', () => {
    wrap(<NetworkToggle />);
    expect(screen.getByRole('button', { name: /Arc Testnet/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Arc$|Main/ })).toBeTruthy();
  });

  it('switches, and remembers the choice', () => {
    wrap(<NetworkToggle />);
    fireEvent.click(screen.getByRole('button', { name: /Main|^Arc$/ }));
    expect(window.localStorage.getItem('hunch-vpm.network')).toBe('mainnet');
  });

  it('restores a stored choice on the next visit', () => {
    window.localStorage.setItem('hunch-vpm.network', 'mainnet');
    wrap(<NetworkToggle />);
    expect(screen.getByRole('button', { name: /Main|^Arc$/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores a junk stored value rather than trusting it', () => {
    window.localStorage.setItem('hunch-vpm.network', 'ethereum');
    wrap(<NetworkToggle />);
    expect(screen.getByRole('button', { name: /Arc Testnet/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('MainnetNotice', () => {
  it('says nothing on testnet', () => {
    const { container } = wrap(<MainnetNotice />);
    expect(container.textContent).not.toMatch(/not been audited/);
  });

  it('warns on mainnet, and names the risk in plain words', () => {
    window.localStorage.setItem('hunch-vpm.network', 'mainnet');
    wrap(<MainnetNotice />);
    expect(screen.getByText(/These contracts have not been audited/)).toBeTruthy();
    expect(screen.getByText(/real USDC/)).toBeTruthy();
    expect(screen.getByText(/no recourse/)).toBeTruthy();
  });

  it('cannot be dismissed', () => {
    // A warning someone can close stops existing for the person most likely to
    // need it, and the risk does not go away when the banner does.
    window.localStorage.setItem('hunch-vpm.network', 'mainnet');
    const { container } = wrap(<MainnetNotice />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });
});
