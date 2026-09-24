import { checkHealth } from "@/lib/services/health.service";

export async function GET() {
  const health = await checkHealth();
  return Response.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
