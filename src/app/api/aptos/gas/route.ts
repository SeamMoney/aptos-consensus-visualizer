import { NextResponse } from "next/server";
import { fetchFromAny, getNetwork } from "../_utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const network = getNetwork(request);

  try {
    const res = await fetchFromAny("/estimate_gas_price", network);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch gas price" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Response format:
    // {
    //   "deprioritized_gas_estimate": 100,
    //   "gas_estimate": 100,
    //   "prioritized_gas_estimate": 150
    // }

    return NextResponse.json({
      low: data.deprioritized_gas_estimate,
      medium: data.gas_estimate,
      high: data.prioritized_gas_estimate,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Gas price fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
