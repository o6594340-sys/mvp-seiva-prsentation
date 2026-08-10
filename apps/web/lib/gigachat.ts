import https from "https";
import { randomUUID } from "crypto";

const OAUTH_HOST = "ngw.devices.sberbank.ru";
const OAUTH_PATH = "/api/v2/oauth";
const API_HOST = "gigachat.devices.sberbank.ru";
const CHAT_PATH = "/api/v1/chat/completions";

// GigaChat's TLS certificate chains up to the Russian Ministry of Digital
// Development root CA, which isn't in Node's default trust store. Proper fix
// is installing that CA (NODE_EXTRA_CA_CERTS); rejectUnauthorized:false here
// is a temporary bypass for local testing only — see CLAUDE.md.
const INSECURE_TLS = { rejectUnauthorized: false };

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, text: data });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.token;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  const scope = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

  if (!authKey) {
    throw new Error("GIGACHAT_AUTH_KEY is not set");
  }

  const body = `scope=${encodeURIComponent(scope)}`;

  const response = await httpsRequest(
    {
      host: OAUTH_HOST,
      port: 9443,
      path: OAUTH_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: randomUUID(),
        Authorization: `Basic ${authKey}`,
        "Content-Length": Buffer.byteLength(body),
      },
      ...INSECURE_TLS,
    },
    body,
  );

  if (response.status !== 200) {
    throw new Error(`GigaChat OAuth failed: ${response.status} ${response.text}`);
  }

  const parsed = JSON.parse(response.text) as { access_token: string; expires_at: number };
  cachedToken = { token: parsed.access_token, expiresAt: parsed.expires_at };
  return parsed.access_token;
}

export async function gigachatChat(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const token = await getAccessToken();

  const body = JSON.stringify({
    model: "GigaChat",
    messages,
    temperature: 0.7,
  });

  const response = await httpsRequest(
    {
      host: API_HOST,
      path: CHAT_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(body),
      },
      ...INSECURE_TLS,
    },
    body,
  );

  if (response.status !== 200) {
    throw new Error(`GigaChat chat completion failed: ${response.status} ${response.text}`);
  }

  const parsed = JSON.parse(response.text) as { choices: { message: { content: string } }[] };
  const content = parsed.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("GigaChat returned no content");
  }

  return content;
}
