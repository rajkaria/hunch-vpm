import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';

import { ACTIVE_CHAIN } from './chains';

/**
 * The WalletConnect project id.
 *
 * There is deliberately **no default**. A project id is a credential, and a
 * placeholder that half-works is worse than an honest absence: without one the
 * app offers injected wallets only and says so, which is a working product for
 * anyone with MetaMask and an accurate statement for everyone else.
 */
export const WALLETCONNECT_PROJECT_ID = process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? '';

export const hasWalletConnect = WALLETCONNECT_PROJECT_ID !== '';

/**
 * One wagmi config for the app.
 *
 * `injected` with `shimDisconnect` so "disconnect" is honoured across reloads —
 * an injected provider has no concept of disconnecting, and without the shim a
 * user who disconnects is silently reconnected by the next page load.
 *
 * Built lazily and memoised: `createConfig` touches browser storage, and Next
 * evaluates this module during prerender where there is none.
 */
let cached: ReturnType<typeof build> | undefined;

function build() {
  const connectors = [
    injected({ shimDisconnect: true }),
    ...(hasWalletConnect
      ? [
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: 'Hunch VPM',
              description: 'The vested parimutuel, on Arc.',
              url: 'https://hunch-vpm.vercel.app',
              icons: ['https://hunch-vpm.vercel.app/icon-192.png'],
            },
          }),
        ]
      : []),
  ];

  return createConfig({
    chains: [ACTIVE_CHAIN],
    connectors,
    // Cookie storage so a connected account survives a server render without
    // the header flashing "Connect wallet" on every navigation.
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: { [ACTIVE_CHAIN.id]: http() },
  });
}

export function walletConfig() {
  cached ??= build();
  return cached;
}
