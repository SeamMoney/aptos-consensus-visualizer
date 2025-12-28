"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Network = "mainnet" | "testnet";

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  apiUrl: string;
  apiKey: string;
  wsEndpoints: string[];
}

const NETWORK_CONFIG: Record<Network, { apiUrl: string; apiKey: string; wsEndpoints: string[] }> = {
  mainnet: {
    apiUrl: "https://api.mainnet.aptoslabs.com/v1",
    apiKey: "AG-PBRRDTVTGPEDATI1NHY3UANNUYSKBPJMA",
    wsEndpoints: [
      "wss://aptos.dorafactory.org/mainnet-ws/",
      "wss://fullnode.mainnet.aptoslabs.com/v1/stream",
    ],
  },
  testnet: {
    apiUrl: "https://api.testnet.aptoslabs.com/v1",
    apiKey: "AG-8SQJ7EMFK4CAWWPKLLFODSO7WQGFTDA1C",
    wsEndpoints: [
      "wss://fullnode.testnet.aptoslabs.com/v1/stream",
    ],
  },
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>("mainnet");

  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
  }, []);

  const config = NETWORK_CONFIG[network];

  return (
    <NetworkContext.Provider
      value={{
        network,
        setNetwork,
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
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
