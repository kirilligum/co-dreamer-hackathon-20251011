# Product Requirements Document: CoDreamer Multi-Step Workflow

**Version**: 1.0
**Date**: 2025-10-11
**Author**: Product Team
**Status**: Planning

---

## Executive Summary

CoDreamer is evolving from a single-step Knowledge Graph (KG) editor into a **3-step workflow application** that helps users generate knowledge graphs from text descriptions and create email summaries. The core value proposition is **human-in-the-loop refinement** of AI-generated content, bridging structured knowledge representation and natural language communication.

**Target Users**: Content strategists, product managers, marketers who need to synthesize customer insights into actionable communications.

---

## Problem Statement

### Current State
Users must manually create knowledge graphs node-by-node, which is time-consuming and requires understanding of graph structures.

### Desired State
Users provide high-level text descriptions (product/customer info) and receive:
1. Auto-generated knowledge graphs
2. Ability to refine graphs via AI chat and manual editing
3. Email summaries derived from refined knowledge graphs

### Success Metrics
- Time to create initial KG: < 30 seconds (from text input)
- User refinement iterations: 2-5 edits per session
- Email generation: < 5 seconds
- User satisfaction: 4+ stars on ease of use

---

## User Stories

### Epic 1: Input & Generation
**As a** product manager
**I want to** input product and customer descriptions
**So that** I can quickly generate a knowledge graph without manual node creation

**Acceptance Criteria**:
- Form accepts 4 inputs: product description, customer description, children count, generation count
- Validation prevents empty required fields
- Generate button triggers KG creation with loading indicator
- Generated KG appears on canvas with auto-layout

---

### Epic 2: Review & Refinement
**As a** content strategist
**I want to** edit the generated knowledge graph
**So that** I can refine and personalize the content before finalizing

**Acceptance Criteria**:
- Knowledge nodes are draggable and editable
- Chat interface allows natural language modifications
- Changes persist across sessions (in agent memory)
- User can like/dislike nodes for feedback
- User can regenerate KG from updated form inputs

---

### Epic 3: Email Generation
**As a** marketer
**I want to** generate an email summary from my refined knowledge graph
**So that** I can communicate insights to stakeholders quickly

**Acceptance Criteria**:
- Generate Email button triggers email creation with loading indicator
- Email appears as editable multi-paragraph text
- User can manually edit email before finalizing
- User can regenerate email after modifying KG
- Email text reflects current state of knowledge graph

---

## Feature Requirements

### 1. Multi-Step Canvas Interface

#### 1.1 Form Node (Step 1)

**Purpose**: Capture user inputs for KG generation

**Fields**:
| Field Name | Type | Default | Required | Description |
|------------|------|---------|----------|-------------|
| Product Description | Textarea | "" | Yes | Free-form text describing the product |
| Customer Description | Textarea | "" | Yes | Free-form text describing target customer |
| Children Count | Number | 2 | Yes | Number of child nodes per parent |
| Generation Count | Number | 3 | Yes | Number of generation iterations |

**Behavior**:
- Always visible on canvas (top-left corner)
- Editable at all workflow steps
- Shows loading spinner during KG generation
- Form validation on Generate button click

**UI Requirements**:
- Fixed width: 400px
- Use Radix UI components for consistency
- Clear visual hierarchy (labels, inputs, spacing)
- Validation errors display inline

---

#### 1.2 Knowledge Graph Nodes (Step 2)

**Purpose**: Display and enable editing of generated knowledge graph

**Node Properties**:
- **Content**: Editable text (textarea)
- **Feedback**: Like/dislike/neutral state
- **Connections**: Edges to related nodes
- **Position**: Draggable on canvas

**Behavior**:
- Generated via "Generate KG" button
- Editable via direct UI interaction or chat commands
- Auto-layout using Dagre algorithm
- Nodes can be created, updated, deleted via chat
- Edges connect related knowledge nodes

**UI Requirements**:
- Node width: 320px, min-height: 220px
- Visual feedback states (green=like, red=dislike)
- Node ID badges for reference in chat
- Delete button (X) on each node
- Handles for creating edges via drag

---

#### 1.3 Email Node (Step 3)

**Purpose**: Display generated email summary for user refinement

**Properties**:
- **Email Text**: Multi-paragraph string (editable)
- **Loading State**: Shows spinner during generation

**Behavior**:
- Always visible on canvas (bottom-right corner)
- Empty until "Generate Email" button clicked
- User can manually edit email text
- Regenerates when user clicks "Generate Email" again

**UI Requirements**:
- Fixed width: 450px, min-height: 300px
- Multi-line textarea with auto-resize
- Clear visual distinction from knowledge nodes
- Loading overlay during generation

---

### 2. Step Navigation Panel

**Purpose**: Provide workflow context and trigger actions

**Location**: Right sidebar (280px width)

**Components**:
- **Step Indicator**: Display current step (1, 2, or 3 of 3)
- **Generate KG Button**: Triggers knowledge graph generation (visible Steps 1-2)
- **Generate Email Button**: Triggers email generation (visible Step 3)

**Behavior**:
- Always visible (no collapse)
- Buttons disabled when validation fails
- Buttons show loading state during API calls
- No manual navigation buttons (indicator only)

**UI Requirements**:
- Simple vertical layout
- Clear visual hierarchy
- Disabled state styling for buttons
- Loading spinner on active button

---

### 3. AI Chat Integration

**Purpose**: Enable natural language refinement of knowledge graph

**Scope** (Current Implementation):
- Chat panel remains on left sidebar
- Existing 7 actions continue to work:
  - createNode, updateNodeContent, appendNodeContent
  - deleteNode, setNodeFeedback
  - createEdge, deleteEdge
- **Critical**: Actions ONLY operate on knowledge nodes (not form/email nodes)

**Behavior**:
- Agent cannot modify form node or email node
- Agent can create/edit/delete knowledge nodes
- Agent can create/delete edges between knowledge nodes
- Agent receives updated instructions about node types

**Future Enhancement** (Out of Scope):
- Agent can advance workflow steps via chat
- Agent can trigger Generate KG/Email actions
- Agent can validate form inputs

---

### 4. API Integration (Mocked)

#### 4.1 Generate KG API

**Endpoint**: `POST /api/generate-kg` (mocked client-side)

**Request Body**:
```json
{
  "productDescription": "string",
  "customerDescription": "string",
  "childrenCount": 2,
  "generationCount": 3
}
```

**Response**:
```json
{
  "nodes": [
    {
      "id": "kg-1",
      "type": "knowledge",
      "content": "Generated insight...",
      "position": { "x": 400, "y": 300 }
    },
    ...
  ],
  "edges": [
    { "id": "e-kg-1-kg-2", "source": "kg-1", "target": "kg-2" },
    ...
  ]
}
```

**Behavior** (Mock):
- 2-second simulated delay
- Returns 4 connected knowledge nodes (similar to sample data)
- Positions calculated via Dagre auto-layout

---

#### 4.2 Generate Email API

**Endpoint**: `POST /api/generate-email` (mocked client-side)

**Request Body**:
```json
{
  "knowledgeGraph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

**Response**:
```json
{
  "emailText": "Dear Customer,\n\nParagraph 1...\n\nParagraph 2...\n\nBest regards"
}
```

**Behavior** (Mock):
- 2-second simulated delay
- Returns multi-paragraph email text
- Placeholder content for initial implementation

---

## User Workflow

### Happy Path

```
1. User lands on canvas
   ├─ Form node visible (top-left)
   ├─ Email node visible but empty (bottom-right)
   └─ Step indicator shows "Step 1 of 3"

2. User fills out form
   ├─ Product Description: "AI-powered analytics tool..."
   ├─ Customer Description: "Data scientists in healthcare..."
   ├─ Children Count: 2
   └─ Generation Count: 3

3. User clicks "Generate KG"
   ├─ Form node shows loading spinner
   ├─ API call (2s delay)
   ├─ 4 knowledge nodes appear in center canvas
   ├─ Auto-layout positions nodes hierarchically
   └─ Step advances to "Step 2 of 3"

4. User reviews knowledge graph
   ├─ Reads node content
   ├─ Marks node as "liked"
   └─ Edits node content directly or via chat

5. User uses chat to refine
   ├─ "Update node kg-1 to include pricing details"
   ├─ Agent updates node content
   └─ Changes reflected immediately

6. User clicks "Generate Email"
   ├─ Email node shows loading spinner
   ├─ API call (2s delay)
   ├─ Multi-paragraph email appears in email node
   └─ Step advances to "Step 3 of 3"

7. User reviews email
   ├─ Manually edits email text if needed
   └─ Final email ready for use

8. (Optional) User refines further
   ├─ Edits knowledge graph nodes
   ├─ Clicks "Generate Email" again
   └─ Email updates based on new graph
```

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| User clicks Generate KG with empty form | Show validation error, prevent API call |
| User regenerates KG after editing form | Replace all existing knowledge nodes with new ones |
| User tries to delete form/email node | Blocked (cannot delete protected nodes) |
| Agent attempts to modify form node via chat | Returns error message to user |
| User clicks Generate Email with no KG nodes | Generate generic email or show error |
| Network error during API call | Show error toast, keep loading state false |

---

## Non-Functional Requirements

### Performance
- KG generation: < 3 seconds (including mock delay)
- Email generation: < 3 seconds (including mock delay)
- Canvas rendering: 60 FPS with up to 50 nodes
- Chat response time: < 2 seconds per message

### Usability
- Form validation feedback: Immediate (on blur)
- Loading indicators: Always visible during async operations
- Error messages: Clear, actionable, non-technical
- No confusing state transitions (always clear what step user is in)

### Accessibility
- All form fields have labels and IDs
- Keyboard navigation works for all interactions
- Focus indicators visible and clear
- Color contrast meets WCAG AA standards

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Technical Constraints

### Agent Memory Architecture
- Use unified `AgentState` with discriminated node types
- All nodes stored in single array: `nodes: CanvasNode[]`
- Agent can only modify `type='knowledge'` nodes
- Protected nodes: `id='form-node'` and `id='email-node'`

### Canvas Layout
- Form node: Fixed position (100, 100)
- Knowledge nodes: Auto-layout in center area
- Email node: Fixed position (800, 600)
- Nodes do not overlap (enforced by layout algorithm)

### State Persistence
- All state synced to agent working memory
- State survives browser refresh (via CopilotKit state management)
- No backend database required (in-memory agent state)

---

## Out of Scope (Future Versions)

### Phase 2 Features
- Real API integration (replace mocks)
- Manual step navigation (Next/Previous buttons)
- Export workflow as PDF/JSON
- Email sending functionality (SMTP integration)
- User authentication & saved workflows

### Phase 3 Features
- Collaborative editing (multi-user)
- Version history & undo/redo
- Custom node templates
- Advanced graph layouts (force-directed, circular)
- Mobile responsive design

---

## Success Metrics & KPIs

### User Engagement
- **Workflow completion rate**: % of users who reach Step 3
- **Average session duration**: 5-10 minutes expected
- **Regeneration rate**: Average # of times user regenerates KG/email

### Quality Metrics
- **Node edit rate**: % of generated nodes that users modify
- **Email edit rate**: % of generated emails that users refine
- **User satisfaction**: Post-session survey (1-5 stars)

### Technical Metrics
- **Error rate**: < 1% of API calls fail
- **Load time**: < 1 second for canvas render
- **Agent accuracy**: Agent successfully modifies only knowledge nodes 100% of time

---

## Dependencies

### External Libraries
- React Flow: Graph visualization (already integrated)
- Radix UI: Form components (new)
- CopilotKit: AI chat integration (already integrated)
- Mastra: Agent framework (already integrated)
- Dagre: Auto-layout algorithm (already integrated)

### Internal Components
- Existing: KnowledgeNode, AppChatHeader, agent actions
- New: FormNode, EmailNode, StepPanel

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Agent modifies protected nodes | High | Medium | Type guards in all actions + clear instructions |
| Zod schema breaks OpenAI function calling | High | Low | Use discriminated union, test JSON schema serialization |
| Real API returns different ID formats | Medium | High | Flexible ID validation (not hardcoded to n1, n2, n3) |
| User confused by 3-panel layout | Medium | Medium | Clear step indicator, contextual buttons |
| Performance degrades with large KGs | Medium | Low | Optimize React Flow rendering, virtual scrolling |

---

## Open Questions

1. **Email content generation**: What algorithm/prompt should real API use to summarize KG?
2. **Node ID format**: What format will real API return for knowledge node IDs?
3. **Analytics tracking**: Should we track user interactions (clicks, edits, time per step)?
4. **Error handling**: What should happen if API fails multiple times? Retry logic?
5. **Data persistence**: Should workflows be saved to backend DB for later retrieval?

---

## Appendix

### Glossary
- **KG**: Knowledge Graph - visual representation of connected knowledge nodes
- **Agent**: AI assistant powered by GPT-4o-mini
- **Working Memory**: Persistent state managed by Mastra agent
- **Discriminated Union**: TypeScript type pattern for distinguishing node types

### Related Documents
- `IMPLEMENTATION_PLAN.md`: Technical implementation details
- `README.md`: Project overview and getting started guide
- `src/lib/canvas/types.ts`: TypeScript type definitions

---

## Approval

**Product Owner**: _____________________
**Engineering Lead**: _____________________
**Design Lead**: _____________________

**Date**: _____________________
