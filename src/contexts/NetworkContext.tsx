"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Network = "mainnet" | "testnet";

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  apiBase: string;
  wsEndpoints: string[];
}

const MAINNET_WS = (process.env.NEXT_PUBLIC_APTOS_WS_MAINNET || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const TESTNET_WS = (process.env.NEXT_PUBLIC_APTOS_WS_TESTNET || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const NETWORK_CONFIG: Record<Network, { wsEndpoints: string[] }> = {
  mainnet: {
    wsEndpoints:
      MAINNET_WS.length > 0
        ? MAINNET_WS
        : [
            "wss://aptos.dorafactory.org/mainnet-ws/",
            "wss://fullnode.mainnet.aptoslabs.com/v1/stream",
          ],
  },
  testnet: {
    wsEndpoints:
      TESTNET_WS.length > 0
        ? TESTNET_WS
        : ["wss://fullnode.testnet.aptoslabs.com/v1/stream"],
  },
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>("testnet");

  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
  }, []);

  const config = NETWORK_CONFIG[network];

  return (
    <NetworkContext.Provider
      value={{
        network,
        setNetwork,
        apiBase: "/api/aptos",
        wsEndpoints: config.wsEndpoints,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
