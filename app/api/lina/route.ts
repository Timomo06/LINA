import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

// Wichtig: wir brauchen Node-Runtime (für fs/path)
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message, firstMessage } = await req.json();

    // System Prompt laden
    const systemPromptPath = path.join(process.cwd(), "src", "data", "systemPrompt.txt");
    const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

    // Anfrage an OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(message ?? "") },
      ],
    });

    // Antworttext holen
    let reply = completion.choices?.[0]?.message?.content ?? "Keine Antwort erhalten.";

    // ** entfernen
    reply = reply.replace(/\*\*/g, "").trim();

    // Nur beim ersten Chat „Hey“ am Anfang einfügen, wenn nicht schon drin
    if (firstMessage && !/^hey\b/i.test(reply)) {
      reply = "Hey! " + reply.charAt(0).toUpperCase() + reply.slice(1);
    }

    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("Fehler in LINA API:", e?.message, e);
    return NextResponse.json(
      { reply: `Fehler: ${e?.message ?? "Unbekannter Fehler"}` },
      { status: 200 }
    );
  }
}
