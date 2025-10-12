# CO-DREAMER: passively discovers & learns new true knowledge

### AI is short-sighted and Sales are impersonal We let AI dream -- passively generates and verifies general knowledge graph allowing quick factual multi-step reasoning. We use iterative RL to respond

## Sponsors

### Mastra: Workflow, Sql, RAG, Evals - [mastra-README](./mastra/README.md)

### WandB: Tracing, RL scores, Inference - [WandB](./WANDB_WEAVE.md)

### OpenPipe: iterative RL on knowledge graph traversal and query response model [OpenPipe Art - README](./ART_RL.md)

### Copilot: UI and batch edit of graph content in UI - [agui-README](./COPILOTKIT.md)

### Tavily: websearch fact check - [verification-service.ts](./mastra/src/dreamer/verification-service.ts)

### Daytona: Dreams deployed and running in the cloud - [daytona-service.ts](./mastra/src/dreamer/daytona-service.ts)

### Browserbase: coding documentations and front end testing

## Project

### Inspiration

Inspired by human dreaming as a mechanism for learning, we explored if an AI could "dream" to passively expand its knowledge. Our goal was to create a self-learning system that moves beyond simple Q&A to actively discover new logical connections. This "dreamed" knowledge is then used to generate highly nuanced, step-by-step arguments for complex tasks, far surpassing the output of standard generative models.

### What it does

CO-DREAMER is an end-to-end system that enables an AI to learn, generate, and self-improve. First, its Knowledge Graph "Dreaming" module passively expands a graph database by taking a starting concept (e.g., a company) and a topic (e.g., a product feature) to create new, atomic nodes and logical pathways. Second, this expanded graph serves as a RAG source for Personalized Outreach, generating multiple, unique email arguments by finding the shortest paths between a customer and a product. Finally, an Interactive UI with Reinforcement Learning allows for innovative batch editing of all email versions with a single command via CopilotKit. Feedback from sent emails (e.g., open rates) creates a reinforcement learning loop, scoring the effectiveness of different "dreamed" argument paths.

### How we built it

We architected a three-part system: 1) A Knowledge Graph Service using a graph database with a backend API for pathfinding and RAG. 2) An Interactive UI built in React, leveraging CopilotKit for the chat interface and parallel LLM calls for batch editing. 3) A Reinforcement Learning Pipeline that captures email performance data in a database to score and refine the knowledge graph paths over time, ensuring the system prioritizes the most effective strategies.

### Challenges we ran into

Our main challenge was constraining the "dream" to maintain relevance. Implementing the batch editing feature at scale was also a complex engineering feat. We are proud of building a functional end-to-end system that demonstrates this novel learning process. The batch editing UI is a key innovation, offering a practical solution for managing AI-generated content at scale by combining automation with human oversight.

### Accomplishments that we're proud of

Our main challenge was constraining the "dream" to maintain relevance. Implementing the batch editing feature at scale was also a complex engineering feat. We are proud of building a functional end-to-end system that demonstrates this novel learning process. The batch editing UI is a key innovation, offering a practical solution for managing AI-generated content at scale by combining automation with human oversight.

### What we learned

We learned to use knowledge graphs as a superior, structured source for RAG. We also gained experience in guiding generative processes and building effective human-in-the-loop systems. This project proved the viability of creating a closed-loop AI application that transforms from a static tool into a dynamic, self-improving system based on real-world feedback.

### What's next for CO-DREAMER: passively discovers & learns new true knowledge

Our next steps are to scale the platform, integrate with marketing automation tools for live feedback, and refine the RL model with more sophisticated reward functions like sentiment analysis of replies. We believe this framework can be adapted to other domains, from generating personalized education plans to discovering novel scientific research pathways.
