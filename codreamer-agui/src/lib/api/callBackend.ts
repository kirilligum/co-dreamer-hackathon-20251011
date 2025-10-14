import type { CoDreamerLearnLoopRequest, CoDreamerLearnLoopResponse, KGNodeSource } from '../canvas/types';
import { exportKGData } from '../canvas/kg-utils';
import type { AgentState } from '../canvas/types';

/**
 * Get CoDreamer backend API URL from environment or default
 */
function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_CODREAMER_API_URL || 'http://localhost:8000';
}

/**
 * Convert AgentState to CoDreamer graph format
 */
function convertToCoDreamerFormat(state: AgentState): CoDreamerLearnLoopRequest['graph'] {
  // Use exportKGData to convert to KGNodeSource format
  const kgNodes: KGNodeSource[] = exportKGData(state);

  // Convert to CoDreamer format (uses 'edge' instead of 'edges')
  return kgNodes.map(node => ({
    id: node.id,
    content: node.content,
    edge: node.edges.map(e => ({
      target_id: e.target_id,
      relationship: e.relationship,
      rationale: e.rationale,
    })),
  }));
}

/**
 * Trigger learn-loop on CoDreamer backend
 * Returns run_id if successful, throws error if failed
 */
export async function triggerLearnLoop(
  state: AgentState,
  options: { iterations?: number; depth?: number } = {}
): Promise<CoDreamerLearnLoopResponse> {
  // Use Next.js API route as proxy to avoid CORS issues
  const url = '/api/trigger-learn-loop';

  const payload: CoDreamerLearnLoopRequest = {
    graph: convertToCoDreamerFormat(state),
    iterations: options.iterations ?? 2,  // Default 2 iterations
    depth: options.depth ?? 2,  // Default depth 2
  };

  console.log('[Backend] Calling learn-loop:', {
    url,
    nodes: payload.graph.length,
    iterations: payload.iterations,
    depth: payload.depth,
  });
  console.log('[Backend] Full payload with node content:');
  payload.graph.forEach((node, i) => {
    console.log(`  Node ${i + 1} (${node.id}): ${node.content.substring(0, 60)}...`);
    console.log(`    Edges: ${node.edge.length} connections`);
  });
  console.log('[Backend] Complete JSON:', JSON.stringify(payload, null, 2));

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    console.error('[Backend] Fetch failed:', fetchError);
    throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
  }

  console.log('[Backend] Response status:', response.status);

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error');
    console.error('[Backend] Error response:', error);
    throw new Error(`Backend error (${response.status}): ${error}`);
  }

  const result: CoDreamerLearnLoopResponse = await response.json();

  console.log('[Backend] Learn-loop started:', result);

  return result;
}

/**
 * Poll webhook endpoint for latest email result
 * Returns null if no result available yet
 */
export async function pollForEmailResult(): Promise<{
  run_id: string;
  final_email: { subject: string; body: string; citations: string[] };
  node_scores: Record<string, number>;
} | null> {
  try {
    console.log('[Polling] Checking for email result...');
    const response = await fetch('/api/final-email', {
      method: 'GET',
      cache: 'no-store',
    });

    console.log('[Polling] Response status:', response.status);

    if (response.status === 404) {
      // No result available yet
      console.log('[Polling] No result yet (404)');
      return null;
    }

    if (!response.ok) {
      console.error('[Polling] Error fetching result:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[Polling] Got result:', result);
    return result;
  } catch (error) {
    console.error('[Polling] Error:', error);
    return null;
  }
}

/**
 * Clear latest email result (for testing)
 */
export async function clearEmailResult(): Promise<void> {
  await fetch('/api/final-email', {
    method: 'DELETE',
  });
}
