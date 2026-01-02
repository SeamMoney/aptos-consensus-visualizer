const DEFAULT_RPC: Record<NetworkName, string> = {
  mainnet: "https://api.mainnet.aptoslabs.com/v1",
  testnet: "https://api.testnet.aptoslabs.com/v1",
};

type NetworkName = "mainnet" | "testnet";

export function getNetwork(request: Request): NetworkName {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("network");
  return raw === "testnet" ? "testnet" : "mainnet";
}

export function getApiKey(network: NetworkName): string | undefined {
  if (network === "testnet") return process.env.APTOS_API_KEY_TESTNET;
  return process.env.APTOS_API_KEY_MAINNET;
}

export function getRpcUrls(network: NetworkName): string[] {
  const envList =
    network === "testnet"
      ? [
          process.env.APTOS_FULLNODE_TESTNET,
          process.env.APTOS_QUICKNODE_TESTNET,
          process.env.APTOS_LABS_TESTNET,
        ]
      : [
          process.env.APTOS_FULLNODE_MAINNET,
          process.env.APTOS_QUICKNODE_MAINNET,
          process.env.APTOS_LABS_MAINNET,
        ];

  const urls = envList.filter(Boolean) as string[];
  if (urls.length > 0) return urls;
  return [DEFAULT_RPC[network]];
}

export function getHeaders(apiKey?: string): HeadersInit {
  // Geomi/Aptos uses x-api-key header format (not Bearer token)
  return apiKey ? { "x-api-key": apiKey } : {};
}

export async function fetchFromAny(
  path: string,
  network: NetworkName,
  init?: RequestInit
): Promise<Response> {
  const urls = getRpcUrls(network);
  const apiKey = getApiKey(network);
  let lastError: Error | null = null;
  let lastRateLimit: { retryAfter: string | null } | null = null;

  for (const base of urls) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          ...getHeaders(apiKey),
          ...(init?.headers || {}),
        },
      });
      if (res.status === 429) {
        lastRateLimit = { retryAfter: res.headers.get("Retry-After") };
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Upstream ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
    }
  }

  if (lastRateLimit) {
    const retryAfter = lastRateLimit.retryAfter || "30";
    return new Response("Rate limited", {
      status: 429,
      headers: { "Retry-After": retryAfter },
    });
  }

  const message = lastError?.message || "Upstream unavailable";
  return new Response(message, { status: 502 });
}
