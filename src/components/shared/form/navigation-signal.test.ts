import assert from "node:assert/strict";
import { test } from "node:test";
import { isNavigationSignal } from "./navigation-signal";

test("redirect and not-found digests are navigation signals", () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;push;/sign-in;307;",
  });
  assert.equal(isNavigationSignal(redirect), true);
  assert.equal(
    isNavigationSignal({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }),
    true,
  );
});

test("ordinary errors are not navigation signals", () => {
  assert.equal(isNavigationSignal(new Error("boom")), false);
  assert.equal(isNavigationSignal(undefined), false);
});
