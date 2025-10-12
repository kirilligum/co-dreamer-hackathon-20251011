import { Mastra } from '@mastra/core/mastra';
import { dreamWorkflow } from './dream-workflow';

// Create a minimal Mastra instance for workflow execution
export const mastra = new Mastra({
  workflows: {
    dreamWorkflow,
  },
});
