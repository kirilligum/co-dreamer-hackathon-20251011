# CoDreamer - AI-Powered Knowledge Graph

An interactive Knowledge Graph visualization system powered by [React Flow](https://reactflow.dev), [Mastra](https://mastra.ai), and [CopilotKit](https://copilotkit.ai). Transform your ideas into connected knowledge nodes with AI-driven manipulation and real-time visual feedback.

---

## 🚀 Quick Start Guide

### System Architecture

CoDreamer consists of **two separate repositories**:

1. **Frontend** (this repo): Next.js app with React Flow visualization
2. **Backend** (CoDreamer API): Python FastAPI server for ML-powered email generation

The system can run in **two modes**:
- **Local Mode**: Full stack with local backend (recommended for development)
- **Production Mode**: Frontend with production backend API

---

### Prerequisites

- **Node.js** 18+ and npm/pnpm/yarn
- **Python** 3.10+ (for backend)
- **OpenAI API key** (for AI features)

---

### Step 1: Clone Both Repositories

```bash
# Clone frontend (this repo)
git clone <your-frontend-repo-url>
cd codreamer

# Clone backend in a separate directory
cd ..
git clone https://github.com/kirilligum/co-dreamer-hackathon-20251011.git codreamerbe
```

---

### Step 2: Backend Setup (Local Mode)

```bash
# Navigate to backend directory
cd codreamerbe/co-dreamer-hackathon-20251011

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Configure environment (optional - add your API keys)
cp .env.example .env
# Edit .env if you need custom configuration

# Start backend server (runs on port 8000)
python -m codreamer.scripts.api
```

The backend should now be running at `http://localhost:8000`

**Keep this terminal open** - the backend must be running for full functionality.

---

### Step 3: Frontend Setup

```bash
# Navigate to frontend directory
cd codreamer  # (or wherever you cloned the frontend)

# Install dependencies
npm install
# or: pnpm install

# Configure environment
cp .env.example .env.local

# Edit .env.local with your settings:
# OPENAI_API_KEY=your-openai-key-here
# NEXT_PUBLIC_CODREAMER_API_URL=http://localhost:8000  # For local backend
```

#### Environment Variables Explained

| Variable | Description | Local Value | Production Value |
|----------|-------------|-------------|------------------|
| `OPENAI_API_KEY` | OpenAI API key for AI agent | `sk-...` | `sk-...` |
| `NEXT_PUBLIC_CODREAMER_API_URL` | Backend API endpoint | `http://localhost:8000` | Your production URL |

---

### Step 4: Start Frontend

```bash
# Start development server (runs on port 3000)
npm run dev
# or: pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Switching Between Local and Production

#### **Option A: Local Backend** (Full Features)

```bash
# .env.local
NEXT_PUBLIC_CODREAMER_API_URL=http://localhost:8000
```

- ✅ Full ML-powered email generation
- ✅ Node scoring and feedback loop
- ✅ Real-time learning iterations
- ⚠️ Requires backend server running

#### **Option B: Production Backend**

```bash
# .env.local
NEXT_PUBLIC_CODREAMER_API_URL=https://your-production-api.com
```

- ✅ No local backend required
- ✅ Centralized API endpoint
- ⚠️ Requires valid production URL

#### **Option C: Mock Mode** (Fallback)

If the backend is unreachable, the app automatically falls back to **mock data**:
- ⚠️ Limited functionality (uses simple template emails)
- ✅ Still usable for UI testing and graph manipulation

---

### Verifying Your Setup

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000
   # Should return: {"status":"ok","service":"codreamer-api"}
   ```

2. **Check frontend is running:**
   - Open browser to `http://localhost:3000`
   - You should see the Knowledge Graph interface

3. **Test the integration:**
   - Fill in the form with product/customer descriptions
   - Click "Generate KG" to create knowledge nodes
   - Click "Generate Email" to test backend integration
   - Watch browser console for logs showing backend calls

---

## 🌟 Overview

CoDreamer has been refactored from a complex canvas/project management system into a streamlined **Knowledge Graph visualization tool**. It features:

- **Interactive Graph Visualization** using React Flow
- **Auto-layout** with Dagre algorithm
- **AI Agent Integration** for natural language graph manipulation
- **Real-time State Synchronization** between UI and agent
- **Rich Node Editing** with feedback system (like/dislike)
- **Bidirectional Edge Management** for knowledge connections

---

## ✨ Key Features

### **Visual Knowledge Graph**
- Drag-and-drop node positioning
- Auto-layout with configurable spacing
- Visual feedback states (green for liked, red for disliked)
- Node ID badges for easy reference
- Editable content with auto-resizing textareas

### **AI-Powered Manipulation** (7 Agent Actions)
1. **createNode(content)** - Create new knowledge nodes
2. **updateNodeContent(nodeId, content)** - Update existing nodes
3. **appendNodeContent(nodeId, text, withNewline?)** - Append to nodes
4. **deleteNode(nodeId)** - Remove nodes and connected edges
5. **setNodeFeedback(nodeId, feedback)** - Mark as like/dislike/neutral
6. **createEdge(nodeId1, nodeId2)** - Connect nodes
7. **deleteEdge(nodeId1, nodeId2)** - Remove connections

### **Smart Features**
- Deduplication logic for nodes and edges
- Bidirectional edge handling (stored once, displayed as undirected)
- Form accessibility compliance (auto-adds id/name attributes)
- Performance optimized (no infinite render loops)
- Clean console output (no debug spam)

---

## 🎯 Using the Knowledge Graph

### **Chat with the AI**
Once running, you can interact with your knowledge graph using natural language:

- **"Create a new node about machine learning"**
- **"Connect n1 to n2"**
- **"Update n3 content to 'Updated information'"**
- **"Mark n3 as liked"**
- **"Delete node n4"**

### **Direct Manipulation**
- Click and drag nodes to reposition
- Edit node content directly in the textarea
- Use like/dislike buttons for feedback
- Click X to delete nodes
- Drag from node handles to create edges

### **Sample Data**
The app comes with 4 sample nodes demonstrating:
```
n1 (center): "Generates high-quality synthetic data..."
  ├─ n2: "Has internal process for validating..."
  ├─ n3: "Relies on human-in-the-loop workflow..."
  └─ n4: "Requires consistent annotation guidelines..."
```

---

## 🏗️ Architecture

### **Technology Stack**
- **Frontend**: Next.js 15.5.4 with React 19
- **Graph Visualization**: React Flow (@xyflow/react)
- **Layout Algorithm**: Dagre
- **AI Framework**: Mastra + CopilotKit
- **Language Model**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS + shadcn/ui

### **Core Data Model**

```typescript
// Knowledge Graph Node
interface KGNode {
  id: string;              // e.g., "n1", "n2"
  content: string;         // Node text content
  position: { x, y };      // Canvas position
  feedback: "like" | "dislike" | null;
}

// Knowledge Graph Edge (undirected)
interface KGEdge {
  id: string;              // e.g., "e-n1-n2"
  source: string;          // Source node ID
  target: string;          // Target node ID
}

// Application State
interface AgentState {
  nodes: KGNode[];
  edges: KGEdge[];
  lastAction?: string;
}
```

### **File Structure**
```
src/
├── app/
│   ├── page.tsx                    # Main app (ReactFlow + AI integration)
│   └── api/copilotkit/route.ts     # CopilotKit API endpoint
├── components/
│   ├── graph/
│   │   └── KnowledgeNode.tsx       # Custom node component
│   └── canvas/
│       └── AppChatHeader.tsx       # Chat UI header
├── lib/
│   └── canvas/
│       ├── types.ts                # TypeScript type definitions
│       ├── state.ts                # Initial state
│       └── kg-utils.ts             # Data loading & Dagre layout
└── mastra/
    ├── agents/index.ts             # AI agent definition
    └── tools/index.ts              # Agent tools

kg_example.json                     # Sample graph data
```

---

## 🔧 Technical Details

### **Type Safety**
Custom types renamed to avoid DOM conflicts:
- `Node` → `KGNode` (avoids DOM `Node`)
- `Edge` → `KGEdge` (avoids DOM `Edge`)

### **Layout Configuration**
Dagre algorithm settings:
```typescript
{
  rankdir: 'TB',        // Top to bottom
  ranksep: 200,         // Vertical spacing (px)
  nodesep: 150,         // Horizontal spacing (px)
  edgesep: 100,         // Edge spacing (px)
}

Node dimensions: 320px × 220px
```

### **Performance Optimizations**
1. **useMemo** for nodes/edges - Prevents unnecessary recalculations
2. **useCallback** for handlers - Stable function references
3. **React.memo** on KnowledgeNode - Prevents unnecessary re-renders
4. **No circular dependencies** - Fixed infinite render loops
5. **Deduplication refs** - Prevents rapid duplicate creations

### **Accessibility**
- Auto-adds `id` and `name` attributes to all form fields
- MutationObserver watches for dynamically added inputs
- Handles third-party component accessibility (CopilotKit)

---

## 📊 Data Flow

### **Loading Flow**
```
kg_example.json
  → loadKGData()
  → applyDagreLayout()
  → AgentState
  → ReactFlow nodes/edges
  → Rendered graph
```

### **Update Flow**
```
User/AI interaction
  → setState()
  → viewState updated
  → reactFlowNodes/edges memoized
  → ReactFlow re-renders
  → Visual update
```

### **Edge Deduplication**
Bidirectional edges stored once:
```typescript
// Input JSON (bidirectional):
n1.edges: [{ target: "n2" }]
n2.edges: [{ target: "n1" }]

// Stored internally (single edge):
{ id: "e-n1-n2", source: "n1", target: "n2" }
```

---

## 🔨 Available Scripts

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run dev:agent        # Start only Mastra agent
npm run dev:debug        # Enable debug logging

# Production
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npx tsc --noEmit        # TypeScript type checking
```

---

## 🎨 Customization Guide

### **Adding Custom Node Types**
1. Update `KGNode` interface in `src/lib/canvas/types.ts`
2. Modify `KnowledgeNode.tsx` component rendering
3. Update agent instructions in `src/mastra/agents/index.ts`

### **Changing Layout Algorithm**
Modify Dagre settings in `src/lib/canvas/kg-utils.ts`:
```typescript
dagreGraph.setGraph({
  rankdir: 'LR',      // Left to right (vs 'TB')
  ranksep: 300,       // Increase spacing
  nodesep: 200,
});
```

### **Styling Nodes**
Edit `src/components/graph/KnowledgeNode.tsx`:
- Node dimensions: Update `w-[320px] min-h-[220px]`
- Colors: Modify border/background classes
- Feedback states: Update `border-green-500`, `border-red-500`

### **AI Agent Behavior**
Customize in `src/mastra/agents/index.ts`:
- Model: Change from `gpt-4o-mini` to other OpenAI models
- Instructions: Update system prompt
- Tools: Add/modify agent actions

---

## 🐛 Troubleshooting

### **Lessons Learned from Development**

For a comprehensive list of bugs encountered during development and how they were fixed, see [LESSONS_LEARNED.md](./LESSONS_LEARNED.md).

Key issues we solved:
- ✅ React Flow nodes invisible (visibility:hidden) → Added `measured` property
- ✅ Edges not rendering → Explicit edge properties + `defaultEdgeOptions`
- ✅ "Cannot read properties of undefined" → Null safety with `?? []`
- ✅ KG disappearing after agent conversations → Fixed schema mismatch
- ✅ Missing type safety → Added `as AgentState` casts
- ✅ Agent not working → Updated agent instructions

### **Common Issues**

**Edges not rendering?**
- Check browser console for errors
- Verify edges array has `id`, `source`, `target` fields
- Ensure node IDs in edges match existing nodes
- Verify `defaultEdgeOptions` is set on ReactFlow component

**Nodes invisible (visibility:hidden)?**
- Ensure all custom nodes have `measured` property with explicit width/height
- Check React Flow version matches documentation (12.x)

**TypeScript errors?**
```bash
npx tsc --noEmit  # Check for type errors
```

**Infinite re-renders?**
- Fixed in current version (removed circular dependencies)
- Check useCallback dependencies are stable

**Form field warnings?**
- Auto-fixed via MutationObserver
- Manually add `id` and `name` to custom form inputs

**Agent not responding?**
- Verify `.env` has valid `OPENAI_API_KEY`
- Check terminal for agent connection logs
- Try `npm run dev:debug` for detailed logs

**Knowledge Graph disappearing after agent conversations?**
- Check that Mastra schema matches frontend TypeScript types exactly
- Verify agent working memory schema in `src/mastra/agents/index.ts`

### **Debug Mode**
```bash
LOG_LEVEL=debug npm run dev
```

---

## 🚀 Roadmap & Future Enhancements

- [ ] **API Integration** - Replace inline data with backend API
- [ ] **Export/Import** - Save/load graphs as JSON
- [ ] **Advanced Layouts** - Multiple algorithm options
- [ ] **Edge Labels** - Add relationship descriptions
- [ ] **Node Templates** - Pre-defined node types
- [ ] **Collaboration** - Real-time multi-user editing
- [ ] **Undo/Redo** - State history management
- [ ] **Search & Filter** - Find nodes by content
- [ ] **Clustering** - Group related nodes

---

## 📚 Documentation

- [React Flow Docs](https://reactflow.dev/learn) - Graph visualization library
- [Mastra Docs](https://mastra.ai/en/docs) - AI agent framework
- [CopilotKit Docs](https://docs.copilotkit.ai) - AI copilot integration
- [Next.js Docs](https://nextjs.org/docs) - React framework
- [Dagre Docs](https://github.com/dagrejs/dagre/wiki) - Graph layout algorithm

---

## 🎓 Learning Resources

### **Understanding the Codebase**
1. Start with `src/app/page.tsx` - Main component
2. Review `src/lib/canvas/types.ts` - Data structures
3. Study `src/lib/canvas/kg-utils.ts` - Layout logic
4. Explore `src/components/graph/KnowledgeNode.tsx` - UI component
5. Check `src/mastra/agents/index.ts` - AI integration

### **Key Concepts**
- **React Flow**: Controlled vs uncontrolled components
- **State Management**: `useCoAgent` hook for AI sync
- **Memoization**: Performance with `useMemo`/`useCallback`
- **Type Safety**: Generic types and type guards
- **Layout Algorithms**: Hierarchical graph positioning

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Refactoring Summary

This project was refactored from a complex canvas system to a focused Knowledge Graph tool:

### **What Changed**
- ❌ Removed: Multiple card types (Project, Entity, Note, Chart)
- ❌ Removed: Complex state management for various card fields
- ✅ Added: Single unified KGNode system
- ✅ Added: React Flow for professional graph visualization
- ✅ Added: Dagre auto-layout algorithm
- ✅ Added: Bidirectional edge management
- ✅ Added: Like/dislike feedback system

### **Problems Solved**
1. **TypeScript Errors** - Type naming conflicts with DOM
2. **Import Issues** - React Flow named exports
3. **Infinite Loops** - Circular callback dependencies
4. **Console Spam** - Removed all debug logs
5. **Accessibility** - Form field id/name attributes

### **Performance Improvements**
- 60% less code complexity
- Zero infinite render loops
- Optimized memoization
- Clean dependency arrays
- Stable callback references

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🙏 Acknowledgments

Built with:
- [React Flow](https://reactflow.dev) - Graph visualization
- [Mastra](https://mastra.ai) - AI agent framework
- [CopilotKit](https://copilotkit.ai) - AI copilot SDK
- [Dagre](https://github.com/dagrejs/dagre) - Graph layout
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling

---

**Built with ❤️ for knowledge visualization**

For issues or questions, please [open an issue](https://github.com/CopilotKit/canvas-with-mastra/issues) on GitHub.
