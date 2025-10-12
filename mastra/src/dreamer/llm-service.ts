import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMGeneratedNode } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export class LLMService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. " +
        "Please create a .env file with your API key or set it in your environment."
      );
    }
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  private generatePrompt(
    customerDetails: string,
    productDetails: string,
    currentNodeContent: string,
    childrenCount: number
  ): string {
    return `Objective:
We are creating a knowledge graph to develop a deep understanding of a potential <customer>. The goal is to support sales and product teams in evaluating product-market fit for our <product>. This knowledge graph will also serve as a contextual resource for responding to user queries.

Knowledge Graph Structure:
The graph is composed of nodes that represent atomic, verifiable facts, and edges that represent the relationships between them. The factual accuracy of all nodes will be verified using web searches.

Task:
Given a <current_node>, generate <children_count> new, exploratory nodes. Create an edge from the <current_node> to each of the new nodes.

<customer>
${customerDetails}
</customer>

<product>
${productDetails}
</product>

<current_node>
${currentNodeContent}
</current_node>

<children_count>
${childrenCount}
</children_count>

Generation Principles:
1. Exploratory Nature: The generated nodes should not be direct attributes of the <current_node>. Instead, they should be exploratory concepts that help build a deeper, more nuanced understanding of the company.
2. Directional Relevance: The <product> serves as a directional guide for the exploration. While the connections may be indirect, each new node should logically progress toward the domain of the <product>.
3. Factuality First: Prioritize factual accuracy and verifiability above immediate relevance to the <product>. The exploration path should be grounded in truth.
4. Reusability: Design nodes to be useful and reusable for understanding the company in various contexts.
5. Naming (ID): Node IDs should be descriptive and concise, typically between one and four words.
6. Rationale: For each generated node, you must provide a clear rationale explaining why it was chosen and how it contributes to the overall objective, specifically linking the <current_node> towards the <product>.

Output Format:
Provide the output strictly as a JSON array of objects, where each object represents a new node and its connection from the <current_node>.

[
  {
    "new_node_id": "Concise Descriptive Name",
    "new_node_content": "Atomic, verifiable fact related to the ID.",
    "relationship": "Relationship type (e.g., relies on, necessitates)",
    "rationale": "Explanation following principle 6."
  }
]

IMPORTANT: Return EXACTLY ${childrenCount} nodes in the array. No more, no less.`;
  }

  async generateNodes(
    customerDetails: string,
    productDetails: string,
    currentNodeContent: string,
    childrenCount: number
  ): Promise<LLMGeneratedNode[]> {
    const prompt = this.generatePrompt(
      customerDetails,
      productDetails,
      currentNodeContent,
      childrenCount
    );

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const generatedNodes: LLMGeneratedNode[] = JSON.parse(text);

      // Validate that we got the right number of nodes
      if (generatedNodes.length !== childrenCount) {
        console.warn(`Expected ${childrenCount} nodes, got ${generatedNodes.length}`);
      }

      return generatedNodes;
    } catch (error) {
      console.error("Error generating nodes:", error);
      throw new Error(`Failed to generate nodes: ${error}`);
    }
  }
}
