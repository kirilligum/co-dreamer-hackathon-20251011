import { NextRequest, NextResponse } from 'next/server';
import type { CoDreamerWebhookPayload } from '@/lib/canvas/types';

// In-memory storage for latest email result (simplest approach, no DB)
let latestEmailResult: CoDreamerWebhookPayload | null = null;

/**
 * POST /api/final-email
 * Webhook endpoint to receive final email results from CoDreamer backend
 */
export async function POST(request: NextRequest) {
  try {
    const payload: CoDreamerWebhookPayload = await request.json();

    // Validate payload structure
    if (!payload.run_id || !payload.final_email || !payload.node_scores) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // Store latest result
    latestEmailResult = payload;

    console.log('[Webhook] Received final email:', {
      run_id: payload.run_id,
      subject: payload.final_email.subject,
      citations: payload.final_email.citations,
      node_count: Object.keys(payload.node_scores).length,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/final-email
 * Retrieve latest email result (for polling)
 */
export async function GET() {
  if (!latestEmailResult) {
    return NextResponse.json(
      { error: 'No email result available' },
      { status: 404 }
    );
  }

  return NextResponse.json(latestEmailResult);
}

/**
 * DELETE /api/final-email
 * Clear latest result (for testing)
 */
export async function DELETE() {
  latestEmailResult = null;
  return NextResponse.json({ ok: true });
}
