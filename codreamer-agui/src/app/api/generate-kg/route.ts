import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate-kg
 * Proxy to Knowledge Dreamer API to avoid CORS issues
 */
export async function POST(request: NextRequest) {
  try {
    const { productDescription, customerDescription, children, generations } = await request.json();

    // Validate required fields
    if (!productDescription || !customerDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: productDescription and customerDescription' },
        { status: 400 }
      );
    }

    const dreamApiUrl = process.env.NEXT_PUBLIC_DREAM_API_URL || 'http://localhost:3457';
    const url = `${dreamApiUrl}/api/v1/dream`;

    console.log('[Dream API] Calling Knowledge Dreamer:', url);
    console.log('[Dream API] Customer:', customerDescription.substring(0, 60) + '...');
    console.log('[Dream API] Product:', productDescription.substring(0, 60) + '...');
    console.log('[Dream API] Children:', children || 2);
    console.log('[Dream API] Generations:', generations || 3);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerDescription,
        product: productDescription,
        children_count: children || 2,
        generations_count_int: generations || 3,
      }),
    });

    console.log('[Dream API] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[Dream API] Error:', error);
      return NextResponse.json(
        { error: `Dream API error: ${error}` },
        { status: response.status }
      );
    }

    const knowledgeGraph = await response.json();
    console.log('[Dream API] Generated', knowledgeGraph.length, 'nodes');

    return NextResponse.json(knowledgeGraph);
  } catch (error) {
    console.error('[Dream API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
