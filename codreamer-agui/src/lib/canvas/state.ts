import type { AgentState, FormNode, EmailNode } from "./types";

// Initial form node at top-left
const initialFormNode: FormNode = {
  id: "form-node",
  type: "form",
  position: { x: 100, y: 100 },
  data: {
    productDescription: "Weights and Biases Weave, featuring a UI for feedback and model evaluation",
    customerDescription: "Pearls of Wisdom, a company that generates synthetic data sets for training AI models",
    childrenCount: 2,
    generationCount: 3,
    isLoading: false,
  },
};

// Initial email node at bottom-right
const initialEmailNode: EmailNode = {
  id: "email-node",
  type: "email",
  position: { x: 800, y: 600 },
  data: {
    emailText: "",
    isLoading: false,
  },
};

export const initialState: AgentState = {
  nodes: [initialFormNode, initialEmailNode],
  edges: [],
  currentStep: 1,
  lastAction: "",
};

export function isNonEmptyAgentState(value: unknown): value is AgentState {
  if (value == null || typeof value !== "object") return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0;
}
