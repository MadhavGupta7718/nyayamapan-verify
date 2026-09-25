import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { getAiAssistService } from "@/services/ai-assist";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["ocr_text", "missing_docs", "nl_search"]),
  text: z.string().optional(),
  uploadedTypes: z.array(z.string()).optional(),
  requiredTypes: z.array(z.string()).optional(),
  query: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Validation error" }, { status: 400 });

  const ai = getAiAssistService();
  if (body.data.action === "ocr_text") {
    return NextResponse.json({
      suggestion: await ai.extractInstrumentFieldsFromText(body.data.text ?? ""),
      safety: "AI Suggested only — user confirmation required. AI never decides PASS/FAIL.",
    });
  }
  if (body.data.action === "missing_docs") {
    return NextResponse.json({
      suggestion: await ai.suggestMissingDocuments(
        body.data.uploadedTypes ?? [],
        body.data.requiredTypes ?? ["previous_certificate", "instrument_photograph"]
      ),
    });
  }
  return NextResponse.json({
    suggestion: await ai.naturalLanguageToFilters(body.data.query ?? ""),
    note: "Returns structured filters only — never executes unrestricted SQL",
  });
}
