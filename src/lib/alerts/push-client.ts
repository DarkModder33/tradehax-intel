import { workerUrl } from "@/lib/live/worker";

export async function pushStatus(fetcher: typeof fetch = fetch): Promise<{ enabled: boolean; publicKey: string | null }> {
  try {
    const response = await fetcher(`${workerUrl()}/v1/push/key`);
    if (!response.ok) return { enabled: false, publicKey: null };
    const body = (await response.json()) as { enabled?: boolean; publicKey?: string | null };
    return { enabled: Boolean(body.enabled && body.publicKey), publicKey: body.publicKey ?? null };
  } catch {
    return { enabled: false, publicKey: null };
  }
}
