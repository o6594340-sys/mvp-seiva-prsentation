const API_URL = "https://api.openai.com/v1/chat/completions";

export async function openaiChat(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI chat completion failed: ${response.status} ${text}`);
  }

  const parsed = JSON.parse(text) as { choices: { message: { content: string } }[] };
  const content = parsed.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned no content");
  }

  return content;
}
