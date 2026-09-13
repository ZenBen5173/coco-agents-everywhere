/** Built from the request, so localhost and a deployment each send Google the address they are reachable at. */
export function redirectUri(request: Request): string {
  return new URL("/api/google/callback", new URL(request.url).origin).toString();
}
