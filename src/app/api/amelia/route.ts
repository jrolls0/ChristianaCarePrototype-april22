import { NextRequest, NextResponse } from 'next/server';
import {
  buildAmeliaSystemPrompt,
  deriveAmeliaActions,
  generateLocalAmeliaResponse,
  type AmeliaRequestPayload,
  type AmeliaRouteResponse,
} from '@/lib/amelia/response';
import { lookupKnowledge } from '@/lib/knowledge/ameliaKnowledge';

export const runtime = 'nodejs';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_MODEL = '@cf/openai/gpt-oss-120b';
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function isValidPayload(value: unknown): value is AmeliaRequestPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AmeliaRequestPayload>;
  return (
    typeof payload.patientId === 'string' &&
    typeof payload.message === 'string' &&
    payload.message.trim().length > 0 &&
    Boolean(payload.patientContext) &&
    typeof payload.patientContext?.patientId === 'string'
  );
}

function extractCloudflareText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const result = root.result;
  if (result && typeof result === 'object') {
    const response = (result as Record<string, unknown>).response;
    if (typeof response === 'string') return response.trim();
  }
  const response = root.response;
  if (typeof response === 'string') return response.trim();
  return null;
}

async function runCloudflareModel(
  payload: AmeliaRequestPayload,
  model: string
): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return null;

  const articles = lookupKnowledge(payload.message);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: buildAmeliaSystemPrompt(payload, articles) },
          ...(payload.conversationMessages ?? []).slice(-6).map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
          })),
          { role: 'user', content: payload.message },
        ],
        temperature: 0.25,
        max_tokens: 650,
      }),
    }
  );

  if (!response.ok) return null;
  return extractCloudflareText(await response.json());
}

async function runCloudflareWithFallback(payload: AmeliaRequestPayload): Promise<string | null> {
  try {
    return (
      (await runCloudflareModel(payload, PRIMARY_MODEL)) ??
      (await runCloudflareModel(payload, FALLBACK_MODEL))
    );
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        id: `amelia-rate-limit-${Date.now()}`,
        content: 'Amelia is receiving too many requests right now. Please wait a moment and try again.',
        actions: [],
        source: 'local-fallback',
      } satisfies AmeliaRouteResponse,
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: 'Invalid Amelia request.' }, { status: 400 });
  }

  const aiText = await runCloudflareWithFallback(payload);
  if (aiText) {
    const articles = lookupKnowledge(payload.message);
    return NextResponse.json({
      id: `amelia-${Date.now()}`,
      content: aiText,
      actions: deriveAmeliaActions(payload.message, payload.patientContext, articles),
      source: 'cloudflare',
    } satisfies AmeliaRouteResponse);
  }

  return NextResponse.json(generateLocalAmeliaResponse(payload));
}
