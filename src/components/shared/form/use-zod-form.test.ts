import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { z } from "zod";
import { useZodForm } from "./use-zod-form";

test("RHF validates raw inputs so the server applies schema transforms once", async () => {
  const schema = z.object({
    count: z
      .number()
      .min(0)
      .transform((value) => value + 1),
  });
  let received: { count: number } | undefined;
  let invalid = false;
  let submit: (() => Promise<void>) | undefined;
  function Probe({ count }: { count: number }) {
    const form = useZodForm(schema, { count });
    submit = form.handleSubmit(
      (input) => {
        received = input;
      },
      () => {
        invalid = true;
      },
    );
    return null;
  }
  renderToString(createElement(Probe, { count: 1 }));
  assert.ok(submit);
  await submit();
  assert.deepEqual(received, { count: 1 });
  assert.deepEqual(schema.parse(received), { count: 2 });

  received = undefined;
  renderToString(createElement(Probe, { count: -1 }));
  await submit();
  assert.equal(received, undefined);
  assert.equal(invalid, true);
});
