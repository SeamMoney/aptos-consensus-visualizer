import { fetchFromAny, getNetwork } from "@/app/api/aptos/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let validatorCache: {
  network: "mainnet" | "testnet" | null;
  data: unknown | null;
  fetchedAt: number;
} = {
  network: null,
  data: null,
  fetchedAt: 0,
};

export async function GET(request: Request) {
  const network = getNetwork(request);
  const now = Date.now();
  const cacheFresh =
    validatorCache.network === network && now - validatorCache.fetchedAt < 60_000;

  if (cacheFresh && validatorCache.data) {
    return new Response(JSON.stringify(validatorCache.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=60",
      },
    });
  }

  const res = await fetchFromAny(
    "/accounts/0x1/resource/0x1::stake::ValidatorSet",
    network,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": res.headers.get("Retry-After") || "",
      },
    });
  }

  // Parse and re-serialize to avoid Content-Encoding issues
  const data = await res.json();
  validatorCache = { network, data, fetchedAt: now };
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "max-age=60",
    },
  });
}
