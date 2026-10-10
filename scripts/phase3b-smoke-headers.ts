// Isolated smoke runner request context. The cookie comes from real HTTP sign-in.
export async function headers() {
  return new Headers({ cookie: process.env.PHASE3B_SMOKE_COOKIE ?? "" });
}
