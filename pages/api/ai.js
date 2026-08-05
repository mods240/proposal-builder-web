export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { system, user } = req.body || {};
  if (!system || !user) {
    return res.status(400).json({ error: "system and user are required" });
  }

  const order = (process.env.AI_PROVIDER_ORDER || "anthropic,openai,gemini")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors = [];

  for (const provider of order) {
    try {
      const text = await callProvider(provider, system, user);
      return res.status(200).json({ text, provider });
    } catch (e) {
      errors.push(`${provider}: ${e.message}`);
      // try next provider
    }
  }

  return res.status(502).json({ error: "All providers failed", details: errors });
}

async function callProvider(provider, system, user) {
  if (provider === "anthropic") return callAnthropic(system, user);
  if (provider === "openai") return callOpenAI(system, user);
  if (provider === "gemini") return callGemini(system, user);
  throw new Error("unknown provider: " + provider);
}

async function callAnthropic(system, user) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error("status " + res.status);
  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  if (!block) throw new Error("no text block in response");
  return block.text;
}

async function callOpenAI(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error("status " + res.status);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("no content in response");
  return text;
}

async function callGemini(system, user) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
      }),
    }
  );
  if (!res.ok) throw new Error("status " + res.status);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("no content in response");
  return text;
}
