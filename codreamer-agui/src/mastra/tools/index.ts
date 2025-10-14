/**
 * Agent Tools
 *
 * Actions are defined in src/app/page.tsx using useCopilotAction hooks.
 * CopilotKit Runtime collects these actions and exposes them to the agent.
 *
 * Available actions (12 total):
 *
 * Knowledge Graph Actions (7):
 * 1. createNode(content)
 * 2. updateNodeContent(nodeId, content)
 * 3. appendNodeContent(nodeId, text, withNewline?)
 * 4. deleteNode(nodeId)
 * 5. setNodeFeedback(nodeId, feedback)
 * 6. createEdge(nodeId1, nodeId2)
 * 7. deleteEdge(nodeId1, nodeId2)
 *
 * Workflow Actions (4):
 * 8. updateFormFields(productDescription?, customerDescription?)
 * 9. generateKnowledgeGraph()
 * 10. generateEmailDraft()
 * 11. runAutopilot()
 *
 * Analytics Actions (1):
 * 12. summarizePipeline()
 */

// Tools configuration is handled by CopilotKit Runtime
