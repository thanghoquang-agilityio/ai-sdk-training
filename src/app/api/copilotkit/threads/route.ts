// CopilotKit v2 hooks poll GET /threads to load server-side thread history.
// This app manages threads client-side (localStorage), so return an empty
// list to satisfy the client without errors or rerenders.
export const runtime = "nodejs";

export function GET(): Response {
  return Response.json({ threads: [], nextCursor: null });
}
