import { describe, expect, it } from "vitest";

import { ConfigError, DEFAULT_CHAIN_ID, isPlaceholderSettler, loadConfig, USDC_ADDRESS } from "../src/config.js";
import { ZERO_ADDRESS } from "../src/format.js";
import { SETTLER } from "./fixtures.js";

const SUBGRAPH = "https://example.test/subgraphs/hunch-vpm";

/** The one required variable, so each test can vary everything else. */
function env(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return { HUNCH_VPM_SUBGRAPH_URL: SUBGRAPH, ...overrides };
}

describe("loadConfig", () => {
  it("defaults to Arc testnet with a placeholder settler", () => {
    const config = loadConfig(env());
    expect(config.chainId).toBe(DEFAULT_CHAIN_ID);
    expect(config.chainName).toBe("Arc testnet");
    expect(config.rpcUrl).toBe("https://rpc.testnet.arc.network");
    expect(config.explorerUrl).toBe("https://testnet.arcscan.app");
    expect(config.graphNetwork).toBe("arc-testnet");
    expect(config.settlerAddress).toBe(ZERO_ADDRESS);
    expect(isPlaceholderSettler(config)).toBe(true);
    expect(config.usdcAddress).toBe(USDC_ADDRESS);
    expect(config.erc8004Registries?.identityRegistry).toBe("0x8004a818bfb912233c491871b3d84c89a494bd9e");
  });

  it("refuses to start without a venue subgraph, because nothing can be read without one", () => {
    let error: unknown;
    try {
      loadConfig({});
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).problems.join("\n")).toMatch(/HUNCH_VPM_SUBGRAPH_URL is required/);
  });

  it("builds a gateway URL from a Studio id and an API key", () => {
    const config = loadConfig({ HUNCH_VPM_SUBGRAPH_ID: "QmSubgraph", HUNCH_VPM_GRAPH_API_KEY: "key123" });
    expect(config.subgraphUrl).toBe("https://gateway.thegraph.com/api/key123/subgraphs/id/QmSubgraph");
  });

  it("will not guess a gateway URL from an id with no key", () => {
    expect(() => loadConfig({ HUNCH_VPM_SUBGRAPH_ID: "QmSubgraph" })).toThrow(/HUNCH_VPM_GRAPH_API_KEY/);
  });

  it("knows Arc mainnet's id without inventing its endpoints", () => {
    const config = loadConfig(env({ HUNCH_VPM_CHAIN_ID: "5042" }));
    expect(config.chainName).toBe("Arc");
    expect(config.graphNetwork).toBe("arc");
    expect(config.rpcUrl).toBeUndefined();
    expect(config.explorerUrl).toBeUndefined();
  });

  it("lowercases addresses so they compare against subgraph ids", () => {
    const config = loadConfig(env({ HUNCH_VPM_SETTLER_ADDRESS: SETTLER.toUpperCase().replace("0X", "0x") }));
    expect(config.settlerAddress).toBe(SETTLER);
    expect(isPlaceholderSettler(config)).toBe(false);
  });

  it("reports every problem at once", () => {
    let error: unknown;
    try {
      loadConfig({
        HUNCH_VPM_CHAIN_ID: "arc",
        HUNCH_VPM_SETTLER_ADDRESS: "0x1234",
        HUNCH_VPM_SUBGRAPH_URL: "not-a-url",
        HUNCH_VPM_REQUEST_TIMEOUT_MS: "100",
      });
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const problems = (error as ConfigError).problems;
    expect(problems).toHaveLength(4);
    expect(problems.join("\n")).toMatch(/HUNCH_VPM_CHAIN_ID/);
    expect(problems.join("\n")).toMatch(/HUNCH_VPM_SETTLER_ADDRESS/);
    expect(problems.join("\n")).toMatch(/HUNCH_VPM_SUBGRAPH_URL/);
    expect(problems.join("\n")).toMatch(/at least 500/);
  });

  it("rejects a non-http endpoint", () => {
    expect(() => loadConfig({ HUNCH_VPM_SUBGRAPH_URL: "ftp://example.test/graphql" })).toThrow(/must be http/);
  });

  it("treats blank strings as unset", () => {
    const config = loadConfig(env({ HUNCH_VPM_GRAPH_API_KEY: "   ", HUNCH_VPM_ERC8004_SUBGRAPH_URL: "" }));
    expect(config.graphApiKey).toBeUndefined();
    expect(config.erc8004SubgraphUrl).toBeUndefined();
  });
});
