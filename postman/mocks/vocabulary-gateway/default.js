/* Local fixture for the installed @ai-sdk/gateway LanguageModelV4 HTTP contract.
 * Synthetic learning text only. No real gateway credentials or uploads.
 * eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== "/language-model")
      return send(501, { error: "Not modelled" });
    const model = req.headers["ai-language-model-id"];
    const body = req.body;
    const recheck = JSON.stringify(body?.prompt).includes("Recheck this same upload carefully");
    const file = body?.prompt
      ?.flatMap((message) =>
        Array.isArray(message.content) ? message.content : [],
      )
      .find((part) => part.type === "file");
    if (
      req.headers["ai-language-model-specification-version"] !== "4" ||
      body?.responseFormat?.type !== "json" ||
      !file?.mediaType ||
      !file?.data
    ) {
      return send(400, {
        error: {
          message: "Invalid SDK request",
          type: "invalid_request_error",
        },
      });
    }
    if (model === "test/limited")
      return send(429, {
        error: { message: "Synthetic rate limit", type: "rate_limit_error" },
      });
    if (model === "test/forbidden")
      return send(403, {
        error: {
          message: "Synthetic credential failure",
          type: "authentication_error",
        },
      });
    if (model === "test/slow")
      await new Promise((resolve) => setTimeout(resolve, 500));
    const sentence = {
      id: "s",
      kind: "sentence",
      arabic: "هذا كتاب",
      arabicDiacritized: "هَذَا كِتَابٌ",
      english: "This is a book.",
      originalArabic: "هذا كتاب",
      originalEnglish: "This is a bok.",
      corrections: ["english_spelling"],
      needsReview: false,
      reviewReason: null,
      sourceIds: [],
    };
    const word = {
      id: "w",
      kind: "word",
      arabic: "كتاب",
      arabicDiacritized: "كِتَابٌ",
      english: "book",
      originalArabic: "كتاب",
      originalEnglish: null,
      corrections: [],
      needsReview: false,
      reviewReason: null,
      sourceIds: ["s"],
    };
    let result = {
      entries: [sentence, word, { ...word, id: "duplicate" }],
      warnings: [],
    };
    if (model === "test/empty")
      result = { entries: [], warnings: ["Nothing readable"] };
    if (model === "test/empty-first" && !recheck)
      result = { entries: [], warnings: ["No Arabic text detected"] };
    if (model === "test/missing-source-first" && !recheck)
      result.entries = result.entries.map((entry) => ({ ...entry, originalArabic: null }));
    if (model === "test/invalid") result = { entries: [{ arabic: 1 }] };
    if (model === "test/ids") result.entries[2].id = "w";
    if (model === "test/uncertain")
      result.entries = [{ ...word, english: "", sourceIds: [] }];
    return send(200, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    });
  })
  .listen(process.env.PORT || 4911);
