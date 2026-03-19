import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const provider = await prisma.llmProvider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ ok: false, error: "Provider not found" });
  }

  try {
    const url = `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Say hi in one word." }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: `API error ${res.status}: ${text}` });
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      model: data.model || provider.model,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
