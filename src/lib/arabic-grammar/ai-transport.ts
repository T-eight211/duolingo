/**
 * AI SDK 6 + Zod 4 transport. The model receives .describe() text but not
 * private UI/dev .meta() keys, which Zod would otherwise serialize into JSON Schema.
 */
import { jsonSchema } from "ai";
import { z } from "zod";
import { GrammarAiSchema, type GrammarAnalysis } from "./schema";

function stripPrivateMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateMetadata);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["developerNote", "ui"].includes(key))
        .map(([key, child]) => [key, stripPrivateMetadata(child)]),
    );
  }
  return value;
}

const providerSchema = stripPrivateMetadata(
  z.toJSONSchema(GrammarAiSchema, { target: "draft-07" }),
) as Parameters<typeof jsonSchema>[0];

export const GrammarAiTransportSchema = jsonSchema<GrammarAnalysis>(providerSchema, {
  validate(value) {
    const result = GrammarAiSchema.safeParse(value);
    return result.success
      ? { success: true as const, value: result.data }
      : { success: false as const, error: new Error(z.prettifyError(result.error)) };
  },
});
