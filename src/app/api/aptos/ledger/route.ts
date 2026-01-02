import { fetchFromAny, getNetwork } from "@/app/api/aptos/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const network = getNetwork(request);
  const res = await fetchFromAny("/", network, { cache: "no-store" });

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
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
