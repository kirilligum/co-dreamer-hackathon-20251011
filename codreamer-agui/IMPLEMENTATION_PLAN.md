# Implementation Plan: Multi-Step KG Generation Workflow

## Overview

Transform CoDreamer from a single-step KG editor into a 3-step workflow:
1. **Input Form** → Generate KG from product/customer descriptions
2. **Review & Edit KG** → Human-in-the-loop refinement
3. **Generate Email** → Create email summary from refined KG

**Key Design Decision**: Unified agent memory with discriminated node types to enable future agent interaction across all steps.

---

## Lessons Learned from Previous Iteration

During the initial KG refactoring, we encountered several critical bugs. **These mistakes must NOT be repeated**. See [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) for full details.

### Critical Errors We Fixed

1. **React Flow nodes invisible (visibility:hidden)** → Missing `measured` property
2. **Edges not rendering** → Missing explicit edge properties and `defaultEdgeOptions`
3. **"Cannot read properties of undefined"** → Missing null safety (`?? []`)
4. **KG disappearing after agent conversations** → Schema mismatch between frontend and Mastra
5. **Missing type safety** → Not following template's `as AgentState` pattern
6. **Agent not working properly** → Outdated agent instructions

### Root Causes

- ❌ Didn't read library documentation thoroughly
- ❌ Changed frontend types without updating Mastra schema
- ❌ No null safety on array operations
- ❌ Didn't follow template patterns
- ❌ Forgot to update agent instructions

---

## Phase 0: Pre-Implementation Safeguards (MANDATORY)

**⚠️ DO THESE BEFORE WRITING ANY CODE**

### Step 0.1: Documentation Review
- [ ] **Read React Flow docs** for custom node/edge requirements
  - Required properties for custom nodes
  - Edge configuration options
  - Common pitfalls with React Flow 12.x
- [ ] **Read Radix UI docs** for form components
  - Component APIs and props
  - Accessibility requirements
  - Styling patterns
- [ ] **Review CopilotKit template** for patterns
  - How does template handle setState?
  - What type safety patterns are used?
  - How are agent instructions structured?

### Step 0.2: Schema Design First
- [ ] **Design Mastra Zod schema BEFORE TypeScript types**
  - Define FormNodeSchema, KnowledgeNodeSchema, EmailNodeSchema
  - Use `z.discriminatedUnion('type', [...])`
  - Keep schemas simple and flat
- [ ] **Test schema serialization**
  ```typescript
  import { zodToJsonSchema } from 'zod-to-json-schema';
  const jsonSchema = zodToJsonSchema(CanvasNodeSchema);
  console.log(JSON.stringify(jsonSchema, null, 2));
  ```
- [ ] **Verify schema works with OpenAI function calling**
  - No complex nested structures
  - All properties have clear descriptions
  - Discriminator field is clear

### Step 0.3: Create Schema Synchronization Checklist
- [ ] Frontend TypeScript types match Mastra Zod schema exactly?
- [ ] Agent instructions reference correct property names?
- [ ] Initial state structure matches schema?
- [ ] Example/mock data matches schema?

### Step 0.4: Add Null Safety by Default
- [ ] Use `?? []` for ALL array operations on agent state
- [ ] Add optional chaining (`?.`) where appropriate
- [ ] Enable TypeScript `strictNullChecks` in tsconfig.json
- [ ] Never assume arrays exist without checking

### Step 0.5: Update Agent Instructions FIRST
- [ ] Document all node types clearly
- [ ] List all available actions with examples
- [ ] Add critical rules (e.g., "don't modify form node")
- [ ] Include examples of correct vs incorrect usage
- [ ] Test instructions with sample prompts

---

## Architecture Changes

### 1. Unified Agent State Schema

**Current Schema**:
```typescript
AgentState = {
  nodes: KGNode[],      // Only knowledge nodes
  edges: KGEdge[]       // Only between knowledge nodes
}
```

**New Schema**:
```typescript
AgentState = {
  nodes: CanvasNode[],        // All node types (form + knowledge + email)
  edges: KGEdge[],            // Only between knowledge nodes
  currentStep: 1 | 2 | 3,     // Workflow step indicator
  lastAction: string
}

type CanvasNode = FormNode | KnowledgeNode | EmailNode

type FormNode = {
  id: 'form-node',
  type: 'form',
  position: { x: number, y: number },
  data: {
    productDescription: string,
    customerDescription: string,
    childrenCount: number,      // Default: 2
    generationCount: number,    // Default: 3
    isLoading: boolean
  }
}

type KnowledgeNode = {
  id: string,                   // Flexible format (not restricted to n1, n2, n3)
  type: 'knowledge',
  position: { x: number, y: number },
  data: {
    content: string,
    feedback: 'like' | 'dislike' | null
  }
}

type EmailNode = {
  id: 'email-node',
  type: 'email',
  position: { x: number, y: number },
  data: {
    emailText: string,
    isLoading: boolean
  }
}
```

---

## Implementation Steps

### Phase 1: Type System & Schema Updates

**⚠️ SCHEMA-FIRST APPROACH: Update Mastra schema BEFORE TypeScript types**

#### 1.1 Update Zod Schema (`src/mastra/agents/index.ts`) - DO THIS FIRST

- [ ] Define `FormNodeSchema` with Zod:
  ```typescript
  const FormNodeSchema = z.object({
    id: z.literal('form-node'),
    type: z.literal('form'),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      productDescription: z.string(),
      customerDescription: z.string(),
      childrenCount: z.number().default(2),
      generationCount: z.number().default(3),
      isLoading: z.boolean().default(false)
    })
  });
  ```

- [ ] Define `EmailNodeSchema` with Zod:
  ```typescript
  const EmailNodeSchema = z.object({
    id: z.literal('email-node'),
    type: z.literal('email'),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      emailText: z.string(),
      isLoading: z.boolean().default(false)
    })
  });
  ```

- [ ] Update `KGNodeSchema` to include type discriminator:
  ```typescript
  const KGNodeSchema = z.object({
    id: z.string(),  // Flexible format
    type: z.literal('knowledge'),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      content: z.string(),
      feedback: z.enum(['like', 'dislike']).nullable()
    })
  });
  ```

- [ ] Use `z.discriminatedUnion('type', [...])` for CanvasNode:
  ```typescript
  const CanvasNodeSchema = z.discriminatedUnion('type', [
    FormNodeSchema,
    KGNodeSchema,
    EmailNodeSchema
  ]);
  ```

- [ ] Update AgentState schema:
  ```typescript
  export const AgentState = z.object({
    nodes: z.array(CanvasNodeSchema).default([]),
    edges: z.array(KGEdgeSchema).default([]),
    currentStep: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    lastAction: z.string().default("")
  });
  ```

- [ ] **TEST SCHEMA SERIALIZATION**:
  ```typescript
  import { zodToJsonSchema } from 'zod-to-json-schema';
  console.log(JSON.stringify(zodToJsonSchema(AgentState), null, 2));
  ```

- [ ] **UPDATE AGENT INSTRUCTIONS** (see Phase 0.5)

#### 1.2 Update Type Definitions (`src/lib/canvas/types.ts`) - DO THIS SECOND

- [ ] Define TypeScript types that EXACTLY match Zod schemas
- [ ] Add comment linking to Mastra schema:
  ```typescript
  // Must match FormNodeSchema in src/mastra/agents/index.ts
  export interface FormNode { ... }
  ```
- [ ] Create discriminated union `CanvasNode` type
- [ ] Update `AgentState` interface to use `CanvasNode[]` and add `currentStep`
- [ ] Export all new types

#### 1.3 Update Initial State (`src/lib/canvas/state.ts`)

- [ ] Initialize with form node at position (100, 100)
- [ ] Initialize with email node at position (800, 600)
- [ ] Set `currentStep: 1`
- [ ] Remove sample KG data (starts empty)
- [ ] **Verify initial state matches AgentState schema**

---

### Phase 2: UI Components

#### 2.1 Create FormNode Component (`src/components/graph/FormNode.tsx`)

**⚠️ CRITICAL: Add all required React Flow properties**

**Features**:
- [ ] 4 form fields using Radix UI components:
  - Product Description (textarea)
  - Customer Description (textarea)
  - Children Count (number input, default 2)
  - Generation Count (number input, default 3)
- [ ] Loading spinner overlay when `isLoading: true`
- [ ] Editable in all steps (not read-only)
- [ ] Save changes to agent state on blur/change
- [ ] Validation: Require non-empty product & customer descriptions
- [ ] **Add form field IDs and names for accessibility**

**Styling**:
- Fixed width: 400px
- Height: auto (accommodates textareas)
- Use Radix UI primitives for consistent look

**React Flow Integration**:
- [ ] Add `measured` property when converting to ReactFlow node:
  ```typescript
  measured: { width: 400, height: 300 }  // Prevents visibility:hidden
  ```
- [ ] Add Handle components if node needs connections (probably not for form node)

#### 2.2 Create EmailNode Component (`src/components/graph/EmailNode.tsx`)

**⚠️ CRITICAL: Add all required React Flow properties**

**Features**:
- [ ] Display multi-paragraph email text
- [ ] Editable textarea (user can refine email)
- [ ] Loading spinner overlay when `isLoading: true`
- [ ] Auto-resize based on content
- [ ] **Add textarea ID and name for accessibility**

**Styling**:
- Fixed width: 450px
- Height: auto
- Min height: 300px

**React Flow Integration**:
- [ ] Add `measured` property when converting to ReactFlow node:
  ```typescript
  measured: { width: 450, height: 300 }  // Prevents visibility:hidden
  ```

#### 2.3 Create StepPanel Component (`src/components/canvas/StepPanel.tsx`)

**Features**:
- [ ] Step indicator: Display "Step 1 of 3", "Step 2 of 3", "Step 3 of 3"
- [ ] Visual progress (simple list or progress bar)
- [ ] "Generate KG" button (visible in Step 1 & 2)
  - Disabled if form validation fails
  - Shows loading state when generating
- [ ] "Generate Email" button (visible in Step 3)
  - Shows loading state when generating
- [ ] No navigation buttons (indicator only)

**Layout**:
- Right sidebar (similar to left chat panel)
- Width: 280px
- Fixed position, always visible

#### 2.4 Update nodeTypes Mapping & ReactFlow Setup (`src/app/page.tsx`)

**⚠️ CRITICAL: Ensure all nodes have `measured` property and edges are explicit**

```typescript
const nodeTypes = useMemo(() => ({
  form: FormNode,
  knowledge: KnowledgeNode,
  email: EmailNode
}), []);

// Convert AgentState nodes to ReactFlow format
const reactFlowNodes = useMemo(() => {
  return (viewState.nodes ?? []).map(node => {
    let measured;
    switch (node.type) {
      case 'form':
        measured = { width: 400, height: 300 };
        break;
      case 'knowledge':
        measured = { width: 320, height: 220 };
        break;
      case 'email':
        measured = { width: 450, height: 300 };
        break;
    }

    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      measured,  // CRITICAL: Prevents visibility:hidden
    };
  });
}, [viewState.nodes]);

// Explicitly define edge properties
const reactFlowEdges = useMemo(() => {
  return (viewState.edges ?? []).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    animated: false,
  }));
}, [viewState.edges]);

// ReactFlow component configuration
<ReactFlow
  nodes={reactFlowNodes}
  edges={reactFlowEdges}
  nodeTypes={nodeTypes}
  defaultEdgeOptions={{  // CRITICAL: Prevents edge rendering issues
    type: 'default',
    animated: false,
  }}
  fitView
  fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
  minZoom={0.2}
  maxZoom={2}
  nodeOrigin={[0, 0]}
  proOptions={{ hideAttribution: true }}
/>
```

**Safeguards**:
- [ ] Add `measured` property to ALL nodes (prevents visibility:hidden)
- [ ] Use `?? []` fallback for nodes and edges arrays
- [ ] Explicitly define edge properties (no spread operator)
- [ ] Add `defaultEdgeOptions` to ReactFlow component

---

### Phase 3: Agent Action Updates

#### 3.1 Add Type Guards to All Actions

All 7 existing actions must validate `node.type === 'knowledge'`:

- [ ] **createNode**: Always creates `type: 'knowledge'`
- [ ] **updateNodeContent**: Check `node.type === 'knowledge'`, return error otherwise
- [ ] **appendNodeContent**: Check `node.type === 'knowledge'`
- [ ] **deleteNode**: Prevent deletion if `node.id === 'form-node' || node.id === 'email-node'`
- [ ] **setNodeFeedback**: Only works on `type: 'knowledge'`
- [ ] **createEdge**: Validate both nodes are `type: 'knowledge'`
- [ ] **deleteEdge**: Only delete edges between knowledge nodes

#### 3.2 Update Agent Instructions

Add to agent instructions:

```
NODE TYPES IN CANVAS:
- type='form' (id='form-node'): Input form, DO NOT MODIFY
- type='knowledge' (id=flexible format): Editable knowledge nodes
- type='email' (id='email-node'): Email text, DO NOT MODIFY

CRITICAL RULES:
- You can ONLY create/update/delete nodes with type='knowledge'
- NEVER modify form-node or email-node
- Only knowledge nodes can have edges
- Knowledge node IDs can be any format (not just n1, n2, n3)

AVAILABLE ACTIONS (unchanged):
- createNode(content) → creates type='knowledge' node
- updateNodeContent(nodeId, content) → only for knowledge nodes
- appendNodeContent(nodeId, text, withNewline?)
- deleteNode(nodeId) → blocked for form/email nodes
- setNodeFeedback(nodeId, feedback)
- createEdge(nodeId1, nodeId2) → only between knowledge nodes
- deleteEdge(nodeId1, nodeId2)

EXAMPLES:
- ❌ BAD: updateNodeContent('form-node', '...')
- ✅ GOOD: updateNodeContent('kg-node-123', '...')
- ✅ GOOD: createNode('New insight about product')
```

---

### Phase 4: API Integration (Mocked)

#### 4.1 Generate KG API (`src/lib/api/generateKG.ts`)

```typescript
async function generateKG(formData: FormData): Promise<KnowledgeNode[]> {
  // Mock API call with 2-second delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Return structure similar to current sample data
  return [
    { id: 'kg-1', type: 'knowledge', position: {...}, data: {...} },
    { id: 'kg-2', type: 'knowledge', position: {...}, data: {...} },
    { id: 'kg-3', type: 'knowledge', position: {...}, data: {...} },
    { id: 'kg-4', type: 'knowledge', position: {...}, data: {...} },
  ];
}
```

**Validation**:
- [ ] Check productDescription and customerDescription are non-empty
- [ ] Return error if validation fails

#### 4.2 Generate Email API (`src/lib/api/generateEmail.ts`)

```typescript
async function generateEmail(kgNodes: KnowledgeNode[]): Promise<string> {
  // Mock API call with 2-second delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Return multi-paragraph email text
  return `Dear Customer,\n\n[Paragraph 1]\n\n[Paragraph 2]\n\n[Paragraph 3]\n\nBest regards`;
}
```

---

### Phase 5: Workflow Logic

#### 5.1 Step Navigation

- [ ] Add `currentStep` to AgentState (persisted in working memory)
- [ ] Right panel displays current step indicator
- [ ] No automatic advancement (user stays on current step until button click)
- [ ] User can manually edit form and regenerate KG anytime

#### 5.2 Generate KG Handler

```typescript
async function handleGenerateKG() {
  // 1. Validate form data
  if (!formNode.data.productDescription || !formNode.data.customerDescription) {
    alert('Please fill in all required fields');
    return;
  }

  // 2. Set form loading state
  setState(prev => updateNode(prev, 'form-node', { isLoading: true }));

  // 3. Call mock API
  const newKGNodes = await generateKG(formNode.data);

  // 4. Apply auto-layout to new nodes
  const layoutedNodes = applyDagreLayout(newKGNodes);

  // 5. Update state: remove old KG nodes, add new ones
  setState(prev => ({
    ...prev,
    nodes: [
      ...prev.nodes.filter(n => n.type !== 'knowledge'),
      ...layoutedNodes
    ],
  }));

  // 6. Clear form loading state
  setState(prev => updateNode(prev, 'form-node', { isLoading: false }));

  // 7. Advance to step 2
  setState(prev => ({ ...prev, currentStep: 2 }));
}
```

#### 5.3 Generate Email Handler

```typescript
async function handleGenerateEmail() {
  // 1. Set email node loading state
  setState(prev => updateNode(prev, 'email-node', { isLoading: true }));

  // 2. Extract knowledge nodes
  const kgNodes = state.nodes.filter(n => n.type === 'knowledge');

  // 3. Call mock API
  const emailText = await generateEmail(kgNodes);

  // 4. Update email node
  setState(prev => updateNode(prev, 'email-node', {
    emailText,
    isLoading: false
  }));

  // 5. Advance to step 3
  setState(prev => ({ ...prev, currentStep: 3 }));
}
```

---

## Canvas Layout

### Node Positioning

| Node Type | Position | Visibility |
|-----------|----------|------------|
| Form | (100, 100) | Always visible |
| Knowledge Nodes | Center (auto-layout via Dagre) | Visible after generation |
| Email | (800, 600) | Always visible |

### Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│                     CoDreamer                            │
├──────────┬────────────────────────────────┬─────────────┤
│          │                                 │   Step      │
│  Chat    │      ReactFlow Canvas          │   Panel     │
│  Panel   │                                 │             │
│  (Left)  │  [Form]    [KG Nodes]   [Email] │  - Step 1/3 │
│  280px   │                                 │  - Generate │
│          │                                 │    KG       │
│          │                                 │  - Generate │
│          │                                 │    Email    │
│          │                                 │   280px     │
└──────────┴────────────────────────────────┴─────────────┘
```

---

## Risk Mitigation

### Risk 1: Agent Modifies Form/Email Nodes

**Mitigation**:
- Type guards in all action handlers
- Clear agent instructions with examples
- Return descriptive errors when agent tries invalid operations

**Test Cases**:
- [ ] Agent attempts `updateNodeContent('form-node', 'test')` → Returns error
- [ ] Agent attempts `deleteNode('email-node')` → Blocked
- [ ] Agent attempts `createEdge('form-node', 'kg-1')` → Returns error

### Risk 2: Zod Schema Too Complex for OpenAI

**Mitigation**:
- Use `z.discriminatedUnion` for proper discriminated union
- Keep schemas simple and flat
- Test schema serialization to JSON schema format

**Validation**:
```typescript
// Ensure this works:
const jsonSchema = zodToJsonSchema(CanvasNodeSchema);
console.log(jsonSchema); // Should produce valid OpenAI function schema
```

### Risk 3: Node ID Format Flexibility

**Problem**: Real API might return knowledge node IDs in any format (not just n1, n2, n3)

**Solution**:
- Use flexible ID matching in all actions
- Update agent instructions to not assume ID format
- Validate by node type, not ID pattern

```typescript
// ❌ OLD: Check if ID matches /^n\d+$/
// ✅ NEW: Check if node.type === 'knowledge'
```

### Risk 4: State Desync Between Node Types

**Mitigation**:
- Single source of truth: `AgentState.nodes`
- All updates go through `setState`
- React Flow reads from single `nodes` array
- No separate state management for different node types

---

## Testing Strategy

### Unit Tests
- [ ] FormNode validation logic
- [ ] Type guards in action handlers
- [ ] Node ID flexibility (various ID formats)
- [ ] Canvas node filtering by type

### Integration Tests
- [ ] Generate KG flow end-to-end
- [ ] Generate Email flow end-to-end
- [ ] Form editing and regeneration
- [ ] Agent cannot modify protected nodes

### Manual Testing Checklist
- [ ] Step 1: Fill form → Generate KG → Verify auto-layout
- [ ] Step 2: Edit KG via chat → Verify changes persist
- [ ] Step 2: Regenerate KG → Verify old nodes replaced
- [ ] Step 3: Generate Email → Verify email appears
- [ ] Step 3: Edit KG → Regenerate Email → Verify email updates
- [ ] Chat agent: Verify it only modifies knowledge nodes
- [ ] Form: Edit values → Regenerate → Verify new KG

---

## File Changes Summary

### New Files
- `src/components/graph/FormNode.tsx` (Form component)
- `src/components/graph/EmailNode.tsx` (Email display component)
- `src/components/canvas/StepPanel.tsx` (Right panel with steps)
- `src/lib/api/generateKG.ts` (Mock KG generation API)
- `src/lib/api/generateEmail.ts` (Mock email generation API)

### Modified Files
- `src/lib/canvas/types.ts` (Add discriminated node types)
- `src/lib/canvas/state.ts` (Update initial state)
- `src/mastra/agents/index.ts` (Update Zod schema + instructions)
- `src/app/page.tsx` (Add type guards, new handlers, right panel)

### Documentation
- `IMPLEMENTATION_PLAN.md` (This file)
- `PRD.md` (Product Requirements Document)
- `README.md` (Update feature list)

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Type System & Schema | 2-3 hours |
| Phase 2: UI Components | 3-4 hours |
| Phase 3: Agent Action Updates | 2 hours |
| Phase 4: API Integration (Mocked) | 1 hour |
| Phase 5: Workflow Logic | 2 hours |
| Testing & Refinement | 2-3 hours |
| **Total** | **12-15 hours** |

---

## Success Criteria

- [ ] Form node renders with all 4 fields and validation
- [ ] Generate KG button creates knowledge nodes with auto-layout
- [ ] Knowledge nodes editable via UI and chat
- [ ] Email node renders with multi-paragraph text
- [ ] Generate Email button updates email based on current KG
- [ ] Agent cannot modify form or email nodes (protected)
- [ ] All 7 existing chat actions work only on knowledge nodes
- [ ] Step indicator shows current step accurately
- [ ] Loading states display correctly during generation
- [ ] User can regenerate KG/email multiple times
- [ ] No TypeScript errors
- [ ] No console warnings/errors

---

## Future Enhancements (Out of Scope)

- Real API integration (replace mock APIs)
- Step navigation buttons (manual advance/back)
- Form field validation UI (error messages)
- Email sending functionality
- Export KG/email to file
- Undo/redo functionality
- Save/load workflow state
- Mobile responsive layout
