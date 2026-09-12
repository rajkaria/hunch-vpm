import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { SpecReader, SpecWriter } from './run.js';
import type { SpecSnapshot } from './decide.js';

/**
 * The chain half of the keeper: three reads per spec, at most one write.
 *
 * `preview` alone is not enough to decide. It returns `(false, 0, 0, 0)` for a
 * spec that is unknown AND for one that has already settled, and it reports no
 * `resolutionTime` or `maxStaleness` — so "not ready" could equally mean the
 * market has not frozen or that the feed is quiet. Both public mappings are read
 * alongside it to tell those apart, because voiding the wrong one is the single
 * most expensive mistake this process can make.
 */

const resolverAbi = [
  {
    type: 'function',
    name: 'preview',
    stateMutability: 'view',
    inputs: [{ name: 'specId', type: 'bytes32' }],
    outputs: [
      { name: 'ready', type: 'bool' },
      { name: 'winner', type: 'uint8' },
      { name: 'price8', type: 'int256' },
      { name: 'age', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'specs',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'settler', type: 'address' },
      { name: 'marketId', type: 'uint256' },
      { name: 'oracle', type: 'address' },
      { name: 'feedKey', type: 'bytes32' },
      { name: 'strike', type: 'int256' },
      { name: 'direction', type: 'uint8' },
      { name: 'resolutionTime', type: 'uint64' },
      { name: 'maxStaleness', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'settled',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'resolve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'specId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'voidStale',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'specId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

const ZERO = '0x0000000000000000000000000000000000000000';

export function createChainReader(options: {
  rpcUrl: string;
  resolver: Address;
  chainId: number;
}): SpecReader {
  const client = createPublicClient({ transport: http(options.rpcUrl) });

  return {
    async read(specId: string): Promise<SpecSnapshot> {
      const id = specId as Hex;
      const common = { address: options.resolver, abi: resolverAbi } as const;

      const [preview, spec, settled] = await Promise.all([
        client.readContract({ ...common, functionName: 'preview', args: [id] }),
        client.readContract({ ...common, functionName: 'specs', args: [id] }),
        client.readContract({ ...common, functionName: 'settled', args: [id] }),
      ]);

      const [ready, winner, , age] = preview;
      const [settler, , , , , , resolutionTime, maxStaleness] = spec;

      return {
        known: settler.toLowerCase() !== ZERO,
        settled,
        ready,
        winner: Number(winner),
        age,
        resolutionTime: BigInt(resolutionTime),
        maxStaleness: BigInt(maxStaleness),
      };
    },
  };
}

/**
 * The writer, which is the only part that holds a key.
 *
 * Constructed separately from the reader so that a dry run — the default — can
 * be assembled without one. The keeper needs no privilege of any kind: anyone
 * may call `resolve`, the caller has no influence on the answer, and it earns
 * nothing for the call. All this key pays for is gas.
 */
export function createChainWriter(options: {
  rpcUrl: string;
  resolver: Address;
  privateKey: Hex;
  chain: Parameters<typeof createWalletClient>[0]['chain'];
}): SpecWriter {
  const account = privateKeyToAccount(options.privateKey);
  const wallet = createWalletClient({
    account,
    chain: options.chain,
    transport: http(options.rpcUrl),
  });

  return {
    async send(specId: string, call: 'resolve' | 'voidStale'): Promise<string> {
      return wallet.writeContract({
        address: options.resolver,
        abi: resolverAbi,
        functionName: call,
        args: [specId as Hex],
        chain: options.chain,
        account,
      });
    },
  };
}
