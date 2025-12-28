"use client";

import { useState, useRef, useEffect } from "react";
import { useNetwork, Network } from "@/contexts/NetworkContext";

interface NetworkSelectorProps {
  connected: boolean;
}

export function NetworkSelector({ connected }: NetworkSelectorProps) {
  const { network, setNetwork } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const networkLabels: Record<Network, string> = {
    mainnet: "Mainnet",
    testnet: "Testnet",
  };

  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`live-badge ${!connected ? 'opacity-50' : ''} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        <span className="live-dot" />
        {connected ? networkLabels[network] : 'Connecting...'}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 py-1 rounded-lg shadow-lg border z-50"
          style={{
            backgroundColor: "var(--chrome-900)",
            borderColor: "var(--chrome-700)",
            minWidth: "120px"
          }}
        >
          {(["mainnet", "testnet"] as Network[]).map((net) => (
            <button
              key={net}
              onClick={() => handleNetworkChange(net)}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
              style={{ color: network === net ? "var(--accent)" : "var(--chrome-300)" }}
            >
              {network === net && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span className={network === net ? "" : "ml-5"}>{networkLabels[net]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
