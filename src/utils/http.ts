export function badRequest(body: Record<string, unknown>, status = 400) {
  return Response.json(body, { status });
}
