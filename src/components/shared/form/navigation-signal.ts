/**
 * Server Functions that call `redirect()` or `notFound()` reject on the client
 * with a Next.js control-flow error after the router has already navigated.
 * These are not failures and must not surface as error toasts.
 */
export function isNavigationSignal(error: unknown) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? (error as { digest: unknown }).digest
      : undefined;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}
