import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type FeedbackPayload = {
  firstName?: string;
  lastName?: string;
  portal?: string;
  feedbackType?: string;
  message?: string;
  context?: Record<string, unknown>;
};

const VALID_PORTALS = new Set([
  'Patient Portal',
  'Transplant Center Portal',
  'Dialysis Clinic Portal',
  'Demo Home',
]);

const VALID_FEEDBACK_TYPES = new Set([
  'Something is confusing',
  'Something looks wrong',
  'Something did not work',
  'Missing feature or idea',
  'General comment',
]);

function cleanText(value: unknown, limit: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, limit);
}

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function validatePayload(value: unknown): FeedbackPayload | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as FeedbackPayload;
  const message = cleanText(input.message, 5000);
  if (!message) return null;

  const portal = VALID_PORTALS.has(input.portal ?? '')
    ? input.portal
    : 'Demo Home';
  const feedbackType = VALID_FEEDBACK_TYPES.has(input.feedbackType ?? '')
    ? input.feedbackType
    : 'General comment';

  return {
    firstName: cleanText(input.firstName, 80),
    lastName: cleanText(input.lastName, 80),
    portal,
    feedbackType,
    message,
    context:
      input.context && typeof input.context === 'object'
        ? (input.context as Record<string, unknown>)
        : {},
  };
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.GOOGLE_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Feedback storage is not configured yet.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid feedback request.' }, { status: 400 });
  }

  const payload = validatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'Please enter feedback before submitting.' },
      { status: 400 }
    );
  }

  const submittedAt = new Date().toISOString();
  const forwardedPayload = {
    ...payload,
    submittedAt,
    requestContext: {
      ip: requestIp(request),
      referer: request.headers.get('referer') ?? '',
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardedPayload),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Feedback could not be saved right now.' },
        { status: 502 }
      );
    }

    const responseText = await response.text();
    let responsePayload: unknown;
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Feedback storage returned an invalid response.' },
        { status: 502 }
      );
    }

    if (
      !responsePayload ||
      typeof responsePayload !== 'object' ||
      (responsePayload as { ok?: unknown }).ok !== true
    ) {
      return NextResponse.json(
        { error: 'Feedback could not be saved right now.' },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Feedback could not be saved right now.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, submittedAt });
}
