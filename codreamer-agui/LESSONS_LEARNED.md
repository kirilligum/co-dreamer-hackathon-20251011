# Lessons Learned: KG Refactoring Iteration

**Context**: During the refactoring from canvas/planning system to Knowledge Graph visualization, we encountered several critical bugs that required debugging and fixes.

**Date**: 2025-10-11
**Iteration**: Initial KG Refactoring

---

## Critical Errors Encountered

### ❌ **Error 1: React Flow Nodes Invisible (visibility:hidden)**

**Symptom**:
- All nodes rendered in DOM with inline style `visibility: hidden`
- Nodes were positioned correctly but not visible to users
- HTML inspection showed: `<div style="visibility: hidden; transform: translate(...)">`

**Root Cause**:
- React Flow hides nodes by default until it measures their dimensions
- We didn't provide `measured` property with explicit width/height
- React Flow's measurement phase never completed, leaving nodes hidden

**Fix Applied**:
```typescript
// page.tsx lines 156-160
measured: {
  width: 320,
  height: 220,
}
```

**Lesson**:
- ⚠️ **ALWAYS read the library's documentation for required properties**
- ⚠️ React Flow requires either `measured` property OR waiting for measurement phase
- Pre-defining dimensions bypasses measurement and prevents visibility issues

**Safeguard for Next Iteration**:
- [ ] Check React Flow docs for any new node/edge properties required
- [ ] Test node visibility immediately after adding new node types
- [ ] Add `measured` property to ALL custom node types upfront

---

### ❌ **Error 2: Edges Not Rendering**

**Symptom**:
- Edge container in DOM was empty: `<div class="react-flow__edges"></div>`
- Expected 3 edges from sample data, but no SVG paths rendered
- Console showed no errors

**Root Cause**:
- Edge objects didn't have all required properties
- Using spread operator without explicit property definition
- Missing `defaultEdgeOptions` in ReactFlow component configuration

**Fix Applied**:
```typescript
// Explicitly define edge properties (lines 164-176)
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

// Add defaultEdgeOptions to ReactFlow component (lines 394-397)
defaultEdgeOptions={{
  type: 'default',
  animated: false,
}}
```

**Lesson**:
- ⚠️ **Spread operators can hide missing properties** - be explicit
- ⚠️ React Flow edges require `id`, `source`, `target`, and `type` at minimum
- Component-level `defaultEdgeOptions` ensures consistent edge behavior

**Safeguard for Next Iteration**:
- [ ] Always define edges explicitly (no spread operator on critical properties)
- [ ] Set `defaultEdgeOptions` on ReactFlow component from the start
- [ ] Test edge rendering immediately after data loading

---

### ❌ **Error 3: "Cannot read properties of undefined (reading 'map')"**

**Symptom**:
- Error occurred after chatting with agent
- Crash at line 134: `return viewState.nodes.map(node => ({`
- Intermittent - didn't happen on every agent interaction

**Root Cause**:
- Agent state updates sometimes returned `undefined` for `nodes` or `edges`
- No null-safety checks on array operations
- State management assumed arrays always exist

**Fix Applied**:
```typescript
// Added null-safe fallbacks throughout page.tsx
(viewState.nodes ?? []).map(...)
(viewState.edges ?? []).map(...)
(base.nodes ?? []).filter(...)
```

**Lesson**:
- ⚠️ **ALWAYS add null safety for arrays from agent state**
- Agent updates can temporarily set properties to undefined
- Defensive programming prevents runtime crashes

**Safeguard for Next Iteration**:
- [ ] Add `?? []` fallback to ALL array operations on agent state
- [ ] Use TypeScript strict null checks
- [ ] Write unit tests for null/undefined state scenarios

---

### ❌ **Error 4: Knowledge Graph Disappearing After Agent Conversations**

**Symptom**:
- User reported: "i see my KG disappears after agent complete the conversation"
- Graph would load initially, but vanish after agent responded
- Most critical bug - broke core functionality

**Root Cause**:
- **Schema mismatch between frontend and backend**
- Frontend used `nodes` and `edges` structure
- Mastra agent schema still had OLD template structure:
  ```typescript
  // ❌ OLD (broken)
  AgentState = z.object({
    items: z.array(...),
    globalTitle: z.string(),
    planSteps: z.array(...),
    // ... old canvas schema
  });
  ```
- Agent's working memory couldn't store `nodes`/`edges`, so data was lost

**Fix Applied**:
```typescript
// ✅ NEW (fixed) - src/mastra/agents/index.ts
const KGNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  feedback: z.enum(["like", "dislike"]).nullable(),
});

const KGEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

export const AgentState = z.object({
  nodes: z.array(KGNodeSchema).default([]),
  edges: z.array(KGEdgeSchema).default([]),
  lastAction: z.string().default(""),
});
```

**Lesson**:
- 🚨 **CRITICAL: Frontend types MUST exactly match Mastra Zod schema**
- Schema mismatches cause silent data loss (no TypeScript errors!)
- Working memory schema is the source of truth for agent persistence

**Safeguard for Next Iteration**:
- [ ] **MANDATORY**: Update Mastra schema BEFORE writing frontend code
- [ ] Write schema validation tests (serialize/deserialize roundtrip)
- [ ] Add comments linking frontend types to Mastra schema
- [ ] Log agent state updates to verify schema compatibility

---

### ❌ **Error 5: Missing Type Safety with setState Returns**

**Symptom**:
- No immediate error, but inconsistent type inference
- Some setState calls didn't guarantee AgentState type

**Root Cause**:
- Not following template's best practice of explicit type casting
- Template used `as AgentState` on all setState returns

**Fix Applied**:
```typescript
// Added type casts to all setState returns
return { ...base, nodes: nextNodes } as AgentState;
return { ...base, edges: updatedEdges } as AgentState;
```

**Lesson**:
- ⚠️ **Follow the template's patterns** - they exist for a reason
- Explicit type casts prevent subtle type inference bugs
- Review template code BEFORE implementing new features

**Safeguard for Next Iteration**:
- [ ] Review CopilotKit template for best practices FIRST
- [ ] Add type casts to all setState operations upfront
- [ ] Enable TypeScript strict mode for better type checking

---

### ❌ **Error 6: Agent Not Receiving Updated Instructions**

**Symptom**:
- Agent actions weren't being called properly
- Agent seemed unaware of available actions

**Root Cause**:
- Mastra agent instructions still referenced old canvas system
- Instructions didn't clearly document the 7 available actions
- No examples showing correct action usage

**Fix Applied**:
```typescript
// Updated agent instructions (src/mastra/agents/index.ts)
instructions: `You are a helpful assistant managing a Knowledge Graph visualization.

Key responsibilities:
- Help users create, update, and organize knowledge nodes
- Connect related nodes with edges to show relationships
...

CRITICAL: Always preserve existing nodes and edges when making updates.`
```

**Lesson**:
- ⚠️ **Update agent instructions whenever changing data model**
- Clear instructions + examples = better agent performance
- Agent instructions are critical for proper behavior

**Safeguard for Next Iteration**:
- [ ] Update agent instructions IMMEDIATELY after schema changes
- [ ] Include examples of correct action usage
- [ ] Test agent behavior with new instructions before declaring done

---

## Root Cause Analysis

### Pattern 1: **Incomplete Library Documentation Review**
- ❌ Assumed React Flow would "just work" without reading docs
- ❌ Missed required properties like `measured` and `defaultEdgeOptions`

**Solution**: Dedicate time to read full documentation for critical libraries

### Pattern 2: **Schema Mismatch Between Frontend/Backend**
- ❌ Changed frontend types without updating Mastra schema
- ❌ No validation to catch schema mismatches early

**Solution**: Treat Mastra schema as source of truth, update it FIRST

### Pattern 3: **Insufficient Null Safety**
- ❌ Assumed arrays would always exist
- ❌ No defensive programming for agent state

**Solution**: Add null safety (`?? []`) to ALL array operations by default

### Pattern 4: **Not Following Template Patterns**
- ❌ Ignored template's type casting pattern
- ❌ Rushed implementation without studying template

**Solution**: Review template thoroughly before implementing features

### Pattern 5: **Poor Agent Instruction Maintenance**
- ❌ Instructions didn't match current system state
- ❌ No examples or clear action documentation

**Solution**: Update agent instructions as part of every schema change

---

## Prevention Checklist for Next Iteration

### **Phase 0: Pre-Implementation** (DO BEFORE CODING)

- [ ] **Read documentation for ALL new libraries/components**
  - React Flow node/edge requirements
  - Radix UI component APIs
  - Any new dependencies

- [ ] **Review CopilotKit template for patterns**
  - How does template handle setState?
  - What type safety patterns are used?
  - How are agent instructions structured?

- [ ] **Design schema FIRST, validate EARLY**
  - Define Mastra Zod schema before TypeScript types
  - Test schema serialization: `zodToJsonSchema(schema)`
  - Verify schema matches OpenAI function calling format

- [ ] **Create schema synchronization checklist**
  - Frontend types match Mastra schema?
  - Agent instructions reference correct properties?
  - Example data matches schema structure?

### **Phase 1: Type System Implementation**

- [ ] **Update Mastra schema FIRST**
  - Define all Zod schemas
  - Test serialization to JSON schema
  - Verify discriminated unions work correctly

- [ ] **Then create TypeScript types**
  - Types should mirror Zod schemas exactly
  - Add comments linking types to schemas
  - Export all types from central location

- [ ] **Add null safety by default**
  - Use `?? []` for ALL array operations
  - Add optional chaining (`?.`) where appropriate
  - Enable TypeScript strict null checks

### **Phase 2: Component Implementation**

- [ ] **Test each component in isolation**
  - FormNode: Test validation, loading states
  - EmailNode: Test editing, loading states
  - Verify React Flow rendering immediately

- [ ] **Add required React Flow properties upfront**
  - `measured` property on all custom nodes
  - `defaultEdgeOptions` on ReactFlow component
  - Explicit edge properties (no spread operator)

### **Phase 3: Agent Integration**

- [ ] **Update agent instructions BEFORE testing**
  - Document all node types clearly
  - List all available actions with examples
  - Add critical rules (e.g., "don't modify form node")

- [ ] **Add type guards to ALL actions**
  - Validate node types before operations
  - Return descriptive errors for invalid operations
  - Test each action with protected nodes

- [ ] **Log agent state updates for debugging**
  ```typescript
  console.log('[State Update]', { nodes: state.nodes?.length, edges: state.edges?.length });
  ```

### **Phase 4: Testing & Validation**

- [ ] **Test schema roundtrip**
  - Create state → Serialize → Deserialize → Verify equality
  - Ensure no data loss through agent working memory

- [ ] **Test null/undefined scenarios**
  - Agent returns undefined for arrays
  - Missing properties in state
  - Empty state initialization

- [ ] **Test agent behavior**
  - Agent can modify knowledge nodes
  - Agent CANNOT modify protected nodes
  - Agent instructions are correct

- [ ] **Visual testing**
  - All nodes visible (no visibility:hidden)
  - Edges render correctly
  - Loading states display properly

---

## Critical Mistakes to NEVER Repeat

### 🚨 **NEVER change frontend types without updating Mastra schema**
This caused the KG disappearing bug - most critical issue

### 🚨 **NEVER skip reading library documentation**
React Flow issues could have been avoided by reading docs upfront

### 🚨 **NEVER assume arrays exist without null checks**
Always use `?? []` fallbacks on agent state arrays

### 🚨 **NEVER implement features without studying the template first**
Template patterns exist for a reason - follow them

### 🚨 **NEVER forget to update agent instructions**
Agent needs clear instructions to behave correctly

---

## Success Criteria for Next Iteration

Before declaring implementation complete, verify:

- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] All nodes visible on canvas (no visibility:hidden)
- [ ] Edges render correctly
- [ ] Agent state persists through conversations
- [ ] Agent instructions are accurate and up-to-date
- [ ] All actions have type guards
- [ ] Null safety on all array operations
- [ ] Schema matches between frontend and Mastra
- [ ] Loading states work correctly
- [ ] Form validation prevents invalid submissions

---

## Reflection: What Went Right

Despite the bugs, we successfully:
- ✅ Refactored from complex canvas to focused KG visualization
- ✅ Integrated React Flow with auto-layout (Dagre)
- ✅ Maintained all 7 agent actions working correctly
- ✅ Added bidirectional edge management
- ✅ Implemented node feedback system (like/dislike)
- ✅ Cleaned up old template code

The foundation is solid - we just need to apply these lessons to the next iteration.

---

## Action Items for Multi-Step Workflow Implementation

Applying lessons learned:

1. **Start with schema** - Update Mastra agent schema FIRST with discriminated union
2. **Read React Flow docs** - Verify new node types don't have special requirements
3. **Add null safety upfront** - All array operations use `?? []` from day 1
4. **Update agent instructions immediately** - Document node types, actions, rules
5. **Test incrementally** - Verify each phase before moving to next
6. **Log state updates** - Keep debugging logs for validation

---

**Next Steps**: Incorporate these safeguards into IMPLEMENTATION_PLAN.md
