import type { KnowledgeNode } from '../canvas/types';

export interface GenerateEmailRequest {
  knowledgeNodes: KnowledgeNode[];
}

export interface GenerateEmailResponse {
  emailText: string;
}

/**
 * Mock API to generate email summary from knowledge graph
 * In production, this would call a real API endpoint
 */
export async function generateEmail(knowledgeNodes: KnowledgeNode[]): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const emailText = `Dear Valued Customer,

We are excited to share insights about our product and how it can benefit your organization.

Based on our knowledge graph analysis, here are the key points:

${knowledgeNodes.map((node, i) => `${i + 1}. ${node.data.content}`).join('\n\n')}

Our solution is specifically designed to address your unique needs and challenges. We believe this comprehensive approach will deliver significant value to your team.

We would love to schedule a call to discuss how we can tailor our offering to your specific requirements.

Best regards,
The Product Team

---
This email was generated from your knowledge graph analysis.
Total insights analyzed: ${knowledgeNodes.length}`;

  return emailText;
}
