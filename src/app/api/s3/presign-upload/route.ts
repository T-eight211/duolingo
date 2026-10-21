import { NextResponse } from "next/server";
import { z } from "zod";

import { getPresignedUploadUrl } from "@/lib/s3";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const uploadSchema = z.object({
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
        message: "Upload key is not allowed.",
      }
    )
    .refine((value) => !value.includes("..") && !value.startsWith("/"), {
      message: "Upload key is invalid.",
    }),
  contentType: z.string().min(1).refine(
    (value) => ALLOWED_UPLOAD_MIME_TYPES.has(value),
    "File type is not allowed."
  ),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_BYTES)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const input = uploadSchema.parse(await request.json());
    const uploadUrl = await getPresignedUploadUrl(input);

    return NextResponse.json({
      key: input.key,
      uploadUrl,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid upload request."
        : error instanceof Error
          ? error.message
          : "Failed to create upload URL.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
