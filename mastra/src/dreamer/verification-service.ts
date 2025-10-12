import axios from 'axios';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-1 scale
  searchResults: SearchResult[];
  summary: string;
  sources: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  images?: string[];
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
  }>;
}

export class VerificationService {
  private apiKey: string;

  constructor() {
    if (!TAVILY_API_KEY) {
      throw new Error(
        "TAVILY_API_KEY environment variable is not set. " +
        "Please create a .env file with your Tavily API key or set it in your environment."
      );
    }
    this.apiKey = TAVILY_API_KEY;
  }

  /**
   * Verify a node's content using Tavily web search
   * @param nodeContent The content to verify
   * @param context Optional context (customer/product info) to make search more specific
   */
  async verifyNode(
    nodeContent: string,
    context?: { customer?: string; product?: string }
  ): Promise<VerificationResult> {
    try {
      // Construct search query
      let searchQuery = nodeContent;
      if (context?.customer) {
        searchQuery = `${nodeContent} ${context.customer}`;
      }

      console.log(`[Verification] Searching for: "${searchQuery}"`);

      // Make request to Tavily API
      const response = await axios.post<TavilyResponse>(
        TAVILY_API_URL,
        {
          query: searchQuery,
          search_depth: "advanced", // Use advanced search for better results
          include_answer: true, // Get AI-generated answer
          include_raw_content: false, // We don't need full HTML
          max_results: 5, // Get top 5 results
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      const data = response.data;

      // Process results
      const searchResults: SearchResult[] = data.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));

      // Calculate verification confidence
      // Based on: number of results, average score, and presence of answer
      const avgScore = searchResults.length > 0
        ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
        : 0;

      const hasAnswer = !!data.answer;
      const hasMultipleResults = searchResults.length >= 2;

      // Confidence scoring:
      // - High score results (>0.8) contribute more
      // - Having an AI answer adds confidence
      // - Multiple corroborating sources increase confidence
      let confidence = avgScore * 0.6; // Base on search scores
      if (hasAnswer) confidence += 0.2; // AI answer adds 20%
      if (hasMultipleResults) confidence += 0.2; // Multiple sources add 20%

      // Clamp confidence between 0 and 1
      confidence = Math.min(1, Math.max(0, confidence));

      // Determine if verified (confidence threshold of 0.5)
      const verified = confidence >= 0.5 && searchResults.length > 0;

      // Create summary
      const summary = data.answer || (searchResults.length > 0
        ? `Found ${searchResults.length} relevant sources. Top result: ${searchResults[0].content.substring(0, 150)}...`
        : 'No verification results found.');

      // Extract sources
      const sources = searchResults.map(r => r.url);

      const result: VerificationResult = {
        verified,
        confidence,
        searchResults,
        summary,
        sources,
      };

      console.log(`[Verification] Result: ${verified ? '✓ VERIFIED' : '✗ UNVERIFIED'} (confidence: ${(confidence * 100).toFixed(1)}%)`);

      return result;

    } catch (error) {
      console.error('[Verification] Error during verification:', error);

      // Return unverified result on error
      return {
        verified: false,
        confidence: 0,
        searchResults: [],
        summary: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sources: [],
      };
    }
  }

  /**
   * Batch verify multiple nodes
   * @param nodes Array of node contents to verify
   * @param context Optional context for all verifications
   */
  async verifyNodes(
    nodes: Array<{ id: string; content: string }>,
    context?: { customer?: string; product?: string }
  ): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    // Process nodes sequentially to avoid rate limiting
    for (const node of nodes) {
      const result = await this.verifyNode(node.content, context);
      results.set(node.id, result);

      // Small delay to avoid rate limiting (250ms between requests)
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    return results;
  }
}
