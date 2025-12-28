"use client";

import { NetworkProvider } from "@/contexts/NetworkContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <NetworkProvider>{children}</NetworkProvider>;
}
