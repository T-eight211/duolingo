import { NextResponse } from "next/server";
import { z } from "zod";

import { getPresignedDownloadUrl } from "@/lib/s3";

const downloadSchema = z.object({
  key: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("purchases/") ||
        value.startsWith("sales/") ||
        value.startsWith("inventory/") ||
        value.startsWith("customers/") ||
        value.startsWith("messages/") ||
        value.startsWith("installment-plans/"),
      {
        message: "Download key is not allowed.",
      }
    )
    .refine((value) => !value.includes("..") && !value.startsWith("/"), {
      message: "Download key is invalid.",
    }),
  method: z.enum(["GET", "HEAD"]).optional(),
});

export async function POST(request: Request) {
  try {
    const input = downloadSchema.parse(await request.json());
    const downloadUrl = await getPresignedDownloadUrl({
      key: input.key,
      method: input.method,
    });

    return NextResponse.json({
      key: input.key,
      downloadUrl,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid download request."
        : error instanceof Error
          ? error.message
          : "Failed to create download URL.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
