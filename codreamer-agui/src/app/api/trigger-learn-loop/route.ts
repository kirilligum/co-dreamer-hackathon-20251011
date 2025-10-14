import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trigger-learn-loop
 * Proxy to CoDreamer backend to avoid CORS issues
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const backendUrl = process.env.NEXT_PUBLIC_CODREAMER_API_URL || 'http://localhost:8000';
    const url = `${backendUrl}/learn-loop`;

    console.log('[Proxy] Forwarding to backend:', url);
    console.log('[Proxy] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[Proxy] Backend response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[Proxy] Backend error:', error);
      return NextResponse.json(
        { error: `Backend error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[Proxy] Backend result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
