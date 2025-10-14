- brainstorming
  - This is a hackathon project called Code Dreamer. The purpose is to create a self-learning AI that passively expands its knowledge. We do this by utilizing existing knowledge graphs. "Passively" means that without anyone querying or triggering it, the AI takes a node in the knowledge graph and creates new nodes from it, refining the understanding of that initial node.

    To provide constraints during expansion, there is a direction, topic, or vision—we will call it a "topic"—guiding the expansion. For example, if you want the "dream" (the expansion) to be about product-market fit, the starting node could be a description of a company, such as "This company, called Pearls of Wisdom, generates synthetic data sets."

    So, this is the starting node. The product is from Weights and Biases, and the feature is Evaluation Judge. The prompt asks what atomic facts (nodes) can be created from the "synthetic data sets creation company" node, moving towards the general direction of using a product that performs evaluation judgment by Weights and Biases.

    After the knowledge graph is expanded, the use case is as follows: Weights and Biases wants to reach out to a client—the company Pearls of Wisdom—for marketing. Weights and Biases needs to create a personalized email arguing that their product, specifically the Evaluation Judge feature, is ideal for Pearls of Wisdom. This requires a step-by-step argument, which is generated from the knowledge graph that was "dreamed."

    When the query to create an email with a structured, step-by-step argument arrives, the LLM (Large Language Model) call performs a retrieval-augmented generation (RAG). Using the knowledge graph, it looks for the shortest path (or multiple shortest paths, but let's assume one for now) to get from the customer node (synthetic data generation) to the product node (Evaluation Judge). It retrieves this path and all the intermediate nodes to create an argument path.

    Actually, instead of Evaluation Judge, let's use "UI for feedback." The nodes might look like this: First, we generate nodes stating that for synthetic data sets, you need verifiable data. For verifiable data, the next level of nodes includes human feedback (not human learning). For human feedback, it is good to have a good UI, and the Weights and Biases product feedback feature has a UI.

    This creates a chain. In the end, you can compare an email generated "with the dream," which has a very detailed path of arguments, and an email generated "without a dream," which is just a general email. This demonstrates that AI with dreaming is much better than AI without dreaming. Self-learning is the dreaming of the AI.

    Now that we have this email data, we can perform reinforcement learning on it, specifically on the different paths of those nodes. As a scoring function, we can use either a human review before sending, or metrics such as whether the email was opened, or if the customer bought the product. We can use this for reinforcement learning on the best way to argue in the email to sell the product, resulting in a reinforcement learning dataset.

    The project has three parts: one is the Knowledge Graph, two is Reinforcement Learning, and the third is the Interactive UI. The interactive UI also includes the backend that controls how data is retrieved from the Knowledge Graph and Reinforcement Learning.

    The knowledge graph is the RAG source. In the UI, when a user writes a query, for example, "Write an email," they specify the starting node and the ending node. This is sent to the knowledge graph service. The service responds with multiple emails because there are multiple paths to traverse the knowledge graph. The response is a JSON structured output. Each email includes the text and the nodes in the path used to generate that text.

    This response goes into the UI, which is handled by CopilotKit. In the UI, a human reviews these emails and can perform batch edits (which we will discuss later). After reviewing the edits, the emails are finalized, and there is a button to send them out. The emails get sent. The input to the knowledge graph consists of the starting node (the company name) and the end node (the Weights and Biases product).

    Once we have responses from the emails—whether they were responded to or not—this data updates the database and feeds into reinforcement learning. Reinforcement learning analyzes different versions of emails, which correspond to different knowledge graph paths. These represent different strategies for arguing that the product is the best fit for the specific customer. Based on the open rates, we determine the best version of the text.

    Now, regarding batch edits. This happens in the UI with Copilot. You have a chat interface where you interact with all versions of the emails simultaneously. It displays the email versions and the chat interface, and you can issue commands like, "Modify the style of the email to be more professional." Parallel LLM calls are made to each version of the email to modify them. This should work for thousands of emails. This batch editing capability is an innovation; people haven't done this before.
- the following is the prompt to **discover new nodes**
  - Objective:
    We are creating a knowledge graph to develop a deep understanding of a potential <customer>. The goal is to support sales and product teams in evaluating product-market fit for our <product>. This knowledge graph will also serve as a contextual resource for responding to user queries.
    Knowledge Graph Structure:
    The graph is composed of nodes that represent atomic, verifiable facts, and edges that represent the relationships between them. The factual accuracy of all nodes will be verified using web searches.
    Task:
    Given a <current_node>, generate three new, exploratory nodes. Create an edge from the <current_node> to each of the three new nodes.
    Generation Principles:
    1. Exploratory Nature: The generated nodes should not be direct attributes of the <current_node>. Instead, they should be exploratory concepts that help build a deeper, more nuanced understanding of the company.
    2. Directional Relevance: The <product> serves as a directional guide for the exploration. While the connections may be indirect, each new node should logically progress toward the domain of the <product>.
    3. Factuality First: Prioritize factual accuracy and verifiability above immediate relevance to the <product>. The exploration path should be grounded in truth.
    4. Reusability: Design nodes to be useful and reusable for understanding the company in various contexts.
    5. Naming: Node names should be descriptive and concise, typically between one and four words.
    6. Rationale: For each generated node, you must provide a clear rationale explaining why it was chosen and how it contributes to the overall objective.
- **example **of the path through the **knowledge graph**
  - [
    {
    "node": "Customer",
    "content": "\"Pearls of Wisdom\" explains and prepares your marketing content for LLM training and crawling",
    "edge_to_next": {
    "relationship": "Performs Job",
    "rationale": "This defines the primary business activity of the customer."
    }
    },
    {
    "node": "Customer Job",
    "content": "Generates high quality synthetic data for LLM pre-training from marketing content like landing pages, blogsposts, user reviews, and news",
    "edge_to_next": {
    "relationship": "has process",
    "rationale": "The company's claim of 'high quality' implies an internal process to validate its own product. Weave's feedback and evaluation tools are directly applicable to building and running this validation process."
    }
    },
    {
    "node": "Process for Quality Validation",
    "content": "Validates synthetic data quality by evaluating the performance of models trained on it",
    "edge_to_next": {
    "relationship": "relies on",
    "rationale": "For nuanced LLM tasks, automated metrics are often insufficient. A robust validation process requires qualitative human judgment, highlighting a direct need for Weave’s UI-based feedback system."
    }
    },
    {
    "node": "Human-in-the-Loop Workflow",
    "content": "Requires a human-in-the-loop workflow for qualitative assessment of model outputs",
    "edge_to_next": {
    "relationship": "necessitates",
    "rationale": "A human-in-the-loop workflow is only effective if the feedback is consistent. This establishes the need for a formal system of instructions (a rubric) for the human reviewers, which points to a need for Weave's 'structured data' feedback type."
    }
    },
    {
    "node": "Annotation Guideline Management",
    "content": "Defines and manages annotation guidelines and rubrics for reviewers",
    "edge_to_next": {
    "relationship": "is solved by",
    "rationale": "The need to collect, manage, and structure human annotations and feedback is a direct use case for a dedicated product feature."
    }
    },
    {
    "node": "Product Feature (Weave Feedback System)",
    "content": "Efficiently evaluating LLM applications requires robust tooling to collect and analyze feedback. W&B Weave provides an integrated feedback system, allowing users to provide call feedback directly through the UI or programmatically via the SDK.",
    "edge_to_next": {
    "relationship": "is a feature of",
    "rationale": "This specific feedback system is a core component of the overall product offering."
    }
    },
    {
    "node": "Product",
    "content": "Weights & Biases (W&B) Weave is a framework for tracking, experimenting with, evaluating, deploying, and improving LLM-based applications."
    }
    ]
- prompt to write emails
  - Persona: You are an experienced salesperson who specializes in demonstrating a perfect product-market fit.
    Task: Write a personalized cold call email pitching the <product> to the <customer>. The email must construct a compelling argument based on a chain of thought that explains why the <product> is a perfect fit for the <customer>.
    Inputs:
    <customer>
    {customer_details}
    </customer>
    <product>
    {product_details}
    </product>
    Logic:
    The chain of thought for the email's argument must be based on the following sequence of nodes. These nodes represent the logical path connecting the <customer> to the <product>.
    <nodes>
    {Node 1}
    {Node 2}
    {Node 3}
    ...
    </nodes>
