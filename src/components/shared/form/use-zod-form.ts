"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type DefaultValues, type FieldValues, useForm } from "react-hook-form";
import type { z } from "zod";

export function useZodForm<
  TInput extends FieldValues,
  TOutput extends FieldValues,
>(schema: z.ZodType<TOutput, TInput>, defaultValues: DefaultValues<TInput>) {
  // Validate raw input here; apply transforms once at the server's trust boundary.
  return useForm<TInput, unknown, TInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues,
  });
}
