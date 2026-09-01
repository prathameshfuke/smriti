/** No auth, no DB — a health check must stay trivially fast and dependency-free. */
export async function GET() {
  return Response.json({ ok: true, timestamp: Date.now() });
}
