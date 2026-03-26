import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return key ? "••••••••" : "";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

export async function GET() {
  const providers = await prisma.llmProvider.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const masked = providers.map((p) => ({
    ...p,
    apiKey: maskApiKey(p.apiKey),
  }));
  return NextResponse.json(masked);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, baseUrl, apiKey, model, purpose } = body;

    if (!name || !type || !baseUrl || !model) {
      return NextResponse.json(
        { error: "name, type, baseUrl, and model are required" },
        { status: 400 }
      );
    }

    const provider = await prisma.llmProvider.create({
      data: {
        name,
        type: type || "openai-compatible",
        baseUrl,
        apiKey: apiKey || "",
        model,
        purpose: purpose || "all",
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (err) {
    console.error("Failed to create LLM provider:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create provider" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.llmProvider.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete LLM provider:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete provider" },
      { status: 500 }
    );
  }
}
