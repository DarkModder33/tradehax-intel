import { loadDashboard } from "@/lib/market/dashboard";
import { parseSymbols } from "@/lib/market/symbols";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbols = parseSymbols(url.searchParams.get("symbols"));
    const payload = await loadDashboard(symbols);
    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The briefing could not be loaded." },
      { status: 500 },
    );
  }
}
