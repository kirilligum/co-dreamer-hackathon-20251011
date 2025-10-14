"use client";

import { useCoAgent, useCopilotAction, useCopilotAdditionalInstructions, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  Position,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AppChatHeader, { PopupHeader } from "@/components/canvas/AppChatHeader";
import KnowledgeNode from "@/components/graph/KnowledgeNode";
import StepPanel from "@/components/canvas/StepPanel";
import CustomerListPanel, { type Customer } from "@/components/canvas/CustomerListPanel";
import { applyDagreLayout } from "@/lib/canvas/kg-utils";
import type { AgentState, CanvasNode, KnowledgeNode as KGNode, FormNode as FNode, EmailNode as ENode, KGEdge } from "@/lib/canvas/types";
import { initialState, isNonEmptyAgentState } from "@/lib/canvas/state";
import useMediaQuery from "@/hooks/use-media-query";
import { generateKG } from "@/lib/api/generateKG";
import { generateEmail } from "@/lib/api/generateEmail";
import { triggerLearnLoop, pollForEmailResult } from "@/lib/api/callBackend";
import { MOCK_CUSTOMERS } from "@/lib/data/mockCustomers";
import { DreamerSpinner } from "@/components/ui/DreamerSpinner";

/**
 * ARCHITECTURE: Multi-Step Workflow with Agent Actions
 *
 * Workflow Steps:
 * 1. Input Form → Generate KG from product/customer descriptions
 * 2. Review & Edit KG → Human-in-the-loop refinement via chat/UI
 * 3. Generate Email → Create email summary from refined KG
 *
 * Node Types (Discriminated Union):
 * - FormNode (id='form-node'): Protected system node for input
 * - KnowledgeNode (id=any): Editable via agent actions
 * - EmailNode (id='email-node'): Protected system node for output
 *
 * Agent Actions (7 total - ONLY work on knowledge nodes):
 * - createNode, updateNodeContent, appendNodeContent
 * - deleteNode, setNodeFeedback
 * - createEdge, deleteEdge
 */

function FlowCanvas() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState,
  });

  // Local loading states
  const [isGeneratingKG, setIsGeneratingKG] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // State protection: prevent agent responses from overwriting during generation
  const isGeneratingRef = useRef(false);

  // Sidebar width states
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [customerListWidth, setCustomerListWidth] = useState(300);

  // Customer management
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(MOCK_CUSTOMERS[0]?.id || null);

  // Per-customer workflow states
  const [customerStates, setCustomerStates] = useState<Record<string, AgentState>>({});

  // Fix form field accessibility warnings from third-party components
  useEffect(() => {
    const addFormFieldIds = () => {
      const formElements = document.querySelectorAll('textarea:not([id]), input:not([type="hidden"]):not([id])');
      formElements.forEach((element, index) => {
        if (!element.id) {
          const role = element.getAttribute('role') || element.tagName.toLowerCase();
          const uniqueId = `${role}-field-${index}-${Date.now()}`;
          element.setAttribute('id', uniqueId);
          element.setAttribute('name', uniqueId);
        }
      });
    };

    addFormFieldIds();
    const observer = new MutationObserver(addFormFieldIds);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const cachedStateRef = useRef<AgentState>(state ?? initialState);
  useEffect(() => {
    // Skip state updates from agent during generation to prevent overwrites
    if (isGeneratingRef.current) {
      console.log('[State Protection] Skipping agent state update during generation');
      return;
    }

    if (isNonEmptyAgentState(state)) {
      cachedStateRef.current = state as AgentState;
      console.log('[State Update]', {
        nodes: (state as AgentState).nodes?.length,
        edges: (state as AgentState).edges?.length,
        currentStep: (state as AgentState).currentStep,
        lastAction: (state as AgentState).lastAction,
      });

      // Save current state to customerStates
      if (selectedCustomerId) {
        setCustomerStates((prev) => ({
          ...prev,
          [selectedCustomerId]: state as AgentState,
        }));
      }
    }
  }, [state, selectedCustomerId]);

  const viewState: AgentState = isNonEmptyAgentState(state) ? (state as AgentState) : cachedStateRef.current;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Deduplication refs
  const lastNodeCreationRef = useRef<{ content: string; id: string; ts: number } | null>(null);
  const lastEdgeCreationRef = useRef<Record<string, number>>({});

  // Get specific nodes from state
  const formNode = useMemo(() =>
    (viewState.nodes ?? []).find(n => n.id === 'form-node') as FNode | undefined,
    [viewState.nodes]
  );

  const emailNode = useMemo(() =>
    (viewState.nodes ?? []).find(n => n.id === 'email-node') as ENode | undefined,
    [viewState.nodes]
  );

  const knowledgeNodes = useMemo(() =>
    (viewState.nodes ?? []).filter(n => n.type === 'knowledge') as KGNode[],
    [viewState.nodes]
  );

  // Helper: Update specific node by ID
  const updateNodeById = useCallback((nodeId: string, updates: Partial<CanvasNode>) => {
    setState((prev) => {
      const base = prev ?? initialState;
      const nodes = (base.nodes ?? []).map((n) =>
        n.id === nodeId ? { ...n, ...updates } as CanvasNode : n
      );
      return { ...base, nodes } as AgentState;
    });
  }, [setState]);

  // Helper: Update knowledge node content/feedback
  const updateKnowledgeNode = useCallback((nodeId: string, updates: Partial<KGNode['data']>) => {
    setState((prev) => {
      const base = prev ?? initialState;
      const nodes = (base.nodes ?? []).map((n) => {
        if (n.id === nodeId && n.type === 'knowledge') {
          return { ...n, data: { ...n.data, ...updates } } as KGNode;
        }
        return n;
      });
      return { ...base, nodes } as AgentState;
    });
  }, [setState]);

  // Helper: Delete knowledge node
  const deleteKnowledgeNode = useCallback((nodeId: string) => {
    setState((prev) => {
      const base = prev ?? initialState;
      const nodes = (base.nodes ?? []).filter((n) => n.id !== nodeId);
      const edges = (base.edges ?? []).filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      return { ...base, nodes, edges, lastAction: `deleted:${nodeId}` } as AgentState;
    });
  }, [setState]);

  // CUSTOMER HANDLERS

  // Handle customer selection - load their workflow state
  const handleSelectCustomer = useCallback((customerId: string) => {
    // Get saved state for this customer, or use initialState if new
    const savedState = customerStates[customerId] || initialState;
    setState(savedState);
    setSelectedCustomerId(customerId);
  }, [customerStates, setState]);

  // Handle customer info update
  const handleUpdateCustomer = useCallback((customerId: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, ...updates } : c))
    );
  }, []);

  // Handle add new customer
  const handleAddCustomer = useCallback(() => {
    const newCustomerId = `cust-${customers.length + 1}`;
    const newCustomer: Customer = {
      id: newCustomerId,
      name: 'New Customer',
      email: `customer${customers.length + 1}@example.com`,
      companyName: 'New Company',
      status: 'new',
    };
    setCustomers((prev) => [...prev, newCustomer]);

    // Initialize with fresh state for new customer
    setState(initialState);
    setSelectedCustomerId(newCustomerId);
  }, [customers.length, setState]);

  // WORKFLOW HANDLERS

  // Handle Generate KG
  const handleGenerateKG = useCallback(async () => {
    console.log('[Generate KG] Starting...');
    if (!formNode) {
      console.log('[Generate KG] No form node found!');
      return;
    }

    const { productDescription, customerDescription } = formNode.data;

    // Validation
    if (!productDescription.trim() || !customerDescription.trim()) {
      alert('Please fill in both product and customer descriptions');
      return;
    }

    try {
      isGeneratingRef.current = true;  // START PROTECTION
      setIsGeneratingKG(true);
      console.log('[Generate KG] Set loading state + state protection');

      // Set form loading state
      updateNodeById('form-node', {
        data: { ...formNode.data, isLoading: true }
      } as Partial<FNode>);

      // Call API
      console.log('[Generate KG] Calling API...');
      const result = await generateKG(formNode.data);
      console.log('[Generate KG] API result:', result);

      // Convert edges first for layout
      const newEdges: KGEdge[] = result.edges.map((e) => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        rationale: e.rationale,
      }));
      console.log('[Generate KG] Converted edges:', newEdges);

      // Apply auto-layout to new nodes WITH edges
      console.log('[Generate KG] Applying layout...');
      const layoutedNodes = applyDagreLayout(
        result.nodes.map(n => ({
          id: n.id,
          content: n.data.content,
          edges: []
        })),
        newEdges  // Pass edges to layout algorithm!
      );
      console.log('[Generate KG] Layouted nodes:', layoutedNodes);

      // Convert to KnowledgeNode format with layout positions
      const newKGNodes: KGNode[] = layoutedNodes.nodes.map((layoutNode: { id: string; content: string; position: { x: number; y: number }; feedback: null }) => {
        const originalNode = result.nodes.find(n => n.id === layoutNode.id);
        return {
          id: layoutNode.id,
          type: 'knowledge' as const,
          position: layoutNode.position,
          data: originalNode!.data
        };
      });
      console.log('[Generate KG] Converted KG nodes:', newKGNodes);

      // Update state: replace knowledge nodes, keep form/email, and clear loading
      console.log('[Generate KG] Updating state...');
      setState((prev) => {
        const base = prev ?? initialState;
        const systemNodes = (base.nodes ?? []).filter(n => n.type !== 'knowledge');
        console.log('[Generate KG] System nodes:', systemNodes);
        console.log('[Generate KG] New KG nodes to add:', newKGNodes);

        // Update form node to clear loading state
        const updatedSystemNodes = systemNodes.map(n => {
          if (n.id === 'form-node' && n.type === 'form') {
            return { ...n, data: { ...n.data, isLoading: false } } as FNode;
          }
          return n;
        });

        const newState = {
          ...base,
          nodes: [...updatedSystemNodes, ...newKGNodes],
          edges: newEdges,
          currentStep: 2,
          lastAction: 'kg_generated'
        } as AgentState;

        console.log('[Generate KG] New state:', newState);
        return newState;
      });

      console.log('[Generate KG] Success!');
    } catch (error) {
      console.error('[Generate KG] Error:', error);
      alert('Failed to generate knowledge graph. Please try again.');

      // Clear loading state on error
      setState((prev) => {
        const base = prev ?? initialState;
        const nodes = (base.nodes ?? []).map((n) => {
          if (n.id === 'form-node' && n.type === 'form') {
            return { ...n, data: { ...n.data, isLoading: false } } as FNode;
          }
          return n;
        });
        return { ...base, nodes } as AgentState;
      });
    } finally {
      setIsGeneratingKG(false);
      isGeneratingRef.current = false;  // END PROTECTION
      console.log('[Generate KG] Cleared state protection');
    }
  }, [formNode, setState, updateNodeById]);

  // Handle Generate Email
  const handleGenerateEmail = useCallback(async () => {
    if (!emailNode) return;

    try {
      isGeneratingRef.current = true;  // START PROTECTION
      setIsGeneratingEmail(true);
      console.log('[Generate Email] Set loading state + state protection');

      // Set email loading state
      setState((prev) => {
        const base = prev ?? initialState;
        const nodes = (base.nodes ?? []).map((n) => {
          if (n.id === 'email-node' && n.type === 'email') {
            return { ...n, data: { ...n.data, isLoading: true } } as ENode;
          }
          return n;
        });
        return { ...base, nodes } as AgentState;
      });

      let usedFallback = false;
      let emailText = '';
      let nodeScores: Record<string, number> = {};
      let runId: string | undefined;

      // Try real backend first
      try {
        console.log('[Generate Email] Calling CoDreamer backend...');
        console.log('[Generate Email] Current viewState nodes:');
        viewState.nodes
          .filter(n => n.type === 'knowledge')
          .forEach((n, i) => {
            console.log(`  ${i + 1}. ${n.id}: "${n.data.content.substring(0, 60)}..."`);
          });
        console.log('[Generate Email] Current viewState edges:', viewState.edges?.length || 0);

        // First, clear any old results
        await fetch('/api/final-email', { method: 'DELETE' });
        console.log('[Generate Email] Cleared old results');

        const result = await triggerLearnLoop(viewState, {
          iterations: 2,
          depth: 2,
        });

        runId = result.run_id;
        console.log('[Generate Email] Learn-loop started with run_id:', runId);
        console.log('[Generate Email] Polling for results...');

        // Poll for results (max 60 seconds, poll every 3 seconds)
        let pollAttempts = 0;
        const maxAttempts = 20;
        let webhookResult = null;

        while (pollAttempts < maxAttempts && !webhookResult) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
          webhookResult = await pollForEmailResult();
          pollAttempts++;
          console.log(`[Generate Email] Poll attempt ${pollAttempts}/${maxAttempts}`, webhookResult ? 'FOUND' : 'not yet');

          if (webhookResult) {
            console.log('[Generate Email] ✅ Got result from webhook:', webhookResult);
            console.log('[Generate Email] Raw node_scores from backend:', webhookResult.node_scores);
            console.log('[Generate Email] Node score types:', Object.entries(webhookResult.node_scores || {}).map(([k, v]) => `${k}: ${typeof v} = ${v}`));
            emailText = `Subject: ${webhookResult.final_email.subject}\n\n${webhookResult.final_email.body}\n\nCitations: ${webhookResult.final_email.citations.join(', ')}`;
            nodeScores = webhookResult.node_scores;
            runId = webhookResult.run_id;
            break;
          }
        }

        if (!webhookResult) {
          console.warn('[Generate Email] ⏱️ Polling timeout after 60s, using fallback');
          throw new Error('Polling timeout');
        }

      } catch (backendError) {
        console.error('[Generate Email] ❌ Backend failed, using mock data:', backendError);
        usedFallback = true;
        emailText = await generateEmail(knowledgeNodes);
      }

      // Update email node, node scores, and advance to step 3
      setState((prev) => {
        const base = prev ?? initialState;

        // Update email node
        const nodes = (base.nodes ?? []).map((n) => {
          if (n.id === 'email-node' && n.type === 'email') {
            return { ...n, data: { emailText, isLoading: false } } as ENode;
          }
          // Update knowledge nodes with scores
          if (n.type === 'knowledge' && nodeScores[n.id] !== undefined) {
            const rawScore = nodeScores[n.id];
            const floatScore = parseFloat(rawScore as any);
            console.log(`[Generate Email] Setting score for ${n.id}: raw=${rawScore} (${typeof rawScore}), parsed=${floatScore} (${typeof floatScore})`);
            return { ...n, data: { ...n.data, score: floatScore } } as KGNode;
          }
          return n;
        });

        return {
          ...base,
          nodes,
          nodeScores,
          runId,
          currentStep: 3,
          lastAction: 'email_generated'
        } as AgentState;
      });

      if (usedFallback) {
        console.info('[Generate Email] Used mock data (backend unavailable)');
      }

    } catch (error) {
      console.error('[Generate Email] Error:', error);
      alert('Failed to generate email. Please try again.');

      // Clear loading state on error
      setState((prev) => {
        const base = prev ?? initialState;
        const nodes = (base.nodes ?? []).map((n) => {
          if (n.id === 'email-node' && n.type === 'email') {
            return { ...n, data: { ...n.data, isLoading: false } } as ENode;
          }
          return n;
        });
        return { ...base, nodes } as AgentState;
      });
    } finally {
      setIsGeneratingEmail(false);
      isGeneratingRef.current = false;  // END PROTECTION
      console.log('[Generate Email] Cleared state protection');
    }
  }, [emailNode, knowledgeNodes, viewState, setState]);

  // Node types for React Flow (only knowledge nodes on canvas)
  const nodeTypes = useMemo(
    () => ({
      knowledge: KnowledgeNode,
    }),
    []
  );

  // Convert to React Flow format - ONLY knowledge nodes (form/email in sidebar)
  const reactFlowNodes = useMemo(() => {
    const nodes = (viewState.nodes ?? [])
      .filter(node => node.type === 'knowledge') // Only show KG nodes on canvas
      .map(node => {
        const data = {
          content: node.data.content,
          feedback: node.data.feedback,
          score: node.data.score,  // Pass node score from CoDreamer backend
          verification: node.data.verification,  // Pass Tavily verification data
          onUpdateContent: (content: string) => {
            updateKnowledgeNode(node.id, { content });
          },
          onSetFeedback: (feedback: "like" | "dislike" | null) => {
            updateKnowledgeNode(node.id, { feedback });
          },
          onDelete: () => {
            deleteKnowledgeNode(node.id);
          },
        };

        if (node.data.score !== undefined) {
          console.log(`[ReactFlow] Node ${node.id} score: ${node.data.score} (type: ${typeof node.data.score})`);
        }

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data,
          width: 400,   // Explicit width for ReactFlow
          height: 180,  // Explicit height for ReactFlow
          measured: { width: 400, height: 180 },  // Prevents visibility:hidden bug
          targetPosition: Position.Top,    // For vertical layout (TB)
          sourcePosition: Position.Bottom,  // For vertical layout (TB)
        };
      });

    console.log('[ReactFlow] Rendering nodes:', nodes.length, nodes.map(n => ({ id: n.id, pos: n.position })));
    return nodes;
  }, [viewState.nodes, updateKnowledgeNode, deleteKnowledgeNode]);

  // Explicitly define edge properties (no spread operator)
  const reactFlowEdges = useMemo(() => {
    const edges = (viewState.edges ?? []).map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      animated: false,
    }));

    console.log('[ReactFlow] Rendering edges:', edges.length, edges.map(e => `${e.source} -> ${e.target}`));
    return edges;
  }, [viewState.edges]);

  // Handle node position changes
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setState(prev => {
      const base = prev ?? initialState;

      // Build current ReactFlow nodes from state
      const rfNodes = (base.nodes ?? []).map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data as unknown as Record<string, unknown>,
      }));

      const updatedRfNodes = applyNodeChanges(changes, rfNodes);

      // Convert back to CanvasNode format
      const updatedNodes: CanvasNode[] = updatedRfNodes.map(rfNode => {
        const existing = (base.nodes ?? []).find(n => n.id === rfNode.id);
        if (!existing) {
          // Shouldn't happen, but fallback to original structure
          console.warn('Node not found in state:', rfNode.id);
          return null;
        }

        return {
          ...existing,
          position: rfNode.position,
        } as CanvasNode;
      }).filter((n): n is CanvasNode => n !== null);

      return { ...base, nodes: updatedNodes } as AgentState;
    });
  }, [setState]);

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setState(prev => {
      const base = prev ?? initialState;

      const rfEdges = (base.edges ?? []).map(edge => ({
        ...edge,
        type: 'default' as const,
        style: { stroke: '#9ca3af', strokeWidth: 2 },
      }));

      const updatedRfEdges = applyEdgeChanges(changes, rfEdges);

      const updatedEdges: KGEdge[] = updatedRfEdges.map(rfEdge => {
        // Preserve relationship from original edge
        const originalEdge = (base.edges ?? []).find(e => e.id === rfEdge.id);
        return {
          id: rfEdge.id,
          source: rfEdge.source,
          target: rfEdge.target,
          relationship: originalEdge?.relationship || 'relates to',
          rationale: originalEdge?.rationale,
        };
      });

      return { ...base, edges: updatedEdges } as AgentState;
    });
  }, [setState]);

  // Handle new edge creation (user drag-connects)
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Only allow connections between knowledge nodes
    const sourceNode = (viewState.nodes ?? []).find(n => n.id === connection.source);
    const targetNode = (viewState.nodes ?? []).find(n => n.id === connection.target);

    if (sourceNode?.type !== 'knowledge' || targetNode?.type !== 'knowledge') {
      return; // Silently ignore connections to/from system nodes
    }

    setState(prev => {
      const base = prev ?? initialState;

      // Check for duplicate
      const exists = (base.edges ?? []).some(e =>
        (e.source === connection.source && e.target === connection.target) ||
        (e.source === connection.target && e.target === connection.source)
      );

      if (exists) return base;

      // Create new edge
      const [id1, id2] = [connection.source, connection.target].sort();
      const newEdge: KGEdge = {
        id: `e-${id1}-${id2}`,
        source: connection.source,
        target: connection.target,
        relationship: 'relates to',  // Default relationship for user-created edges
      };

      return {
        ...base,
        edges: [...(base.edges ?? []), newEdge],
      } as AgentState;
    });
  }, [setState, viewState.nodes]);

  // COPILOT READABLES - Expose customer pipeline data to agent

  // Expose customer list
  useCopilotReadable({
    description: "List of all customers in the pipeline with their status and basic info",
    value: customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      companyName: customer.companyName,
      status: customer.status,
      isSelected: customer.id === selectedCustomerId,
    })),
  });

  // Expose workflow states for all customers
  useCopilotReadable({
    description: "Workflow progress for each customer - which step they are on and whether they have generated KG or email",
    value: Object.entries(customerStates).map(([customerId, state]) => {
      const customer = customers.find(c => c.id === customerId);
      const kgNodeCount = state.nodes?.filter(n => n.type === 'knowledge').length || 0;
      const hasEmail = state.nodes?.some(n => n.id === 'email-node' && n.type === 'email' && n.data.emailText) || false;

      return {
        customerId,
        customerName: customer?.name || 'Unknown',
        currentStep: state.currentStep,
        stepDescription: state.currentStep === 1 ? 'Form Input' : state.currentStep === 2 ? 'KG Editing' : 'Email Review',
        knowledgeNodeCount: kgNodeCount,
        hasGeneratedEmail: hasEmail,
        lastAction: state.lastAction,
      };
    }),
  });

  // Expose pipeline statistics
  useCopilotReadable({
    description: "Overall pipeline statistics - total customers, workflow completion rates, and outreach status",
    value: {
      totalCustomers: customers.length,
      selectedCustomer: customers.find(c => c.id === selectedCustomerId)?.name || 'None',
      statusBreakdown: {
        new: customers.filter(c => c.status === 'new').length,
        sent: customers.filter(c => c.status === 'sent').length,
        opened: customers.filter(c => c.status === 'opened').length,
        inConvo: customers.filter(c => c.status === 'in convo').length,
      },
      workflowProgress: {
        atFormInput: Object.values(customerStates).filter(s => s.currentStep === 1).length,
        atKGEditing: Object.values(customerStates).filter(s => s.currentStep === 2).length,
        atEmailReview: Object.values(customerStates).filter(s => s.currentStep === 3).length,
      },
      customersWithEmail: Object.values(customerStates).filter(state =>
        state.nodes?.some(n => n.id === 'email-node' && n.type === 'email' && n.data.emailText)
      ).length,
    },
  });

  // AGENT ACTIONS (with type guards to protect system nodes)

  // 1. Create Node (ONLY creates knowledge nodes)
  useCopilotAction({
    name: "createNode",
    description: "Create a new knowledge node. Returns the new node ID.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: true, description: "Node content text." },
    ],
    handler: ({ content }: { content: string }) => {
      const normalized = (content ?? "").trim();

      // Check for recent duplicate
      const now = Date.now();
      const recent = lastNodeCreationRef.current;
      if (recent && recent.content === normalized && now - recent.ts < 3000) {
        return recent.id;
      }

      // Check if similar node exists
      const existing = knowledgeNodes.find(
        (n) => n.data.content.trim().toLowerCase() === normalized.toLowerCase()
      );
      if (existing) return existing.id;

      // Generate new ID
      let createdId = "";
      setState((prev) => {
        const base = prev ?? initialState;

        const maxId = knowledgeNodes.reduce((max, n) => {
          const match = n.id.match(/\d+/);
          const num = match ? parseInt(match[0], 10) : 0;
          return Math.max(max, num);
        }, 0);

        createdId = `kg-${maxId + 1}`;

        const newNode: KGNode = {
          id: createdId,
          type: 'knowledge',
          position: { x: Math.random() * 400 + 300, y: Math.random() * 400 + 200 },
          data: { content: normalized, feedback: null },
        };

        return {
          ...base,
          nodes: [...(base.nodes ?? []), newNode],
          lastAction: `created:${createdId}`,
        } as AgentState;
      });

      lastNodeCreationRef.current = { content: normalized, id: createdId, ts: now };
      return createdId;
    },
  });

  // 2. Update Node Content (ONLY knowledge nodes)
  useCopilotAction({
    name: "updateNodeContent",
    description: "Update a knowledge node's content. Provide the node ID.",
    available: "remote",
    parameters: [
      { name: "nodeId", type: "string", required: true, description: "Node ID" },
      { name: "content", type: "string", required: true, description: "New content" },
    ],
    handler: ({ nodeId, content }: { nodeId: string; content: string }) => {
      const node = (viewState.nodes ?? []).find((n) => n.id === nodeId);

      // Type guard: only allow knowledge nodes
      if (!node) return `error:node_not_found:${nodeId}`;
      if (node.type !== 'knowledge') return `error:cannot_modify_system_node:${nodeId}`;

      updateKnowledgeNode(nodeId, { content });
      return `updated:${nodeId}`;
    },
  });

  // 3. Append to Node Content (ONLY knowledge nodes)
  useCopilotAction({
    name: "appendNodeContent",
    description: "Append text to existing knowledge node content.",
    available: "remote",
    parameters: [
      { name: "nodeId", type: "string", required: true },
      { name: "text", type: "string", required: true },
      { name: "withNewline", type: "boolean", required: false },
    ],
    handler: ({ nodeId, text, withNewline }: { nodeId: string; text: string; withNewline?: boolean }) => {
      const node = (viewState.nodes ?? []).find((n) => n.id === nodeId);

      // Type guard
      if (!node) return `error:node_not_found:${nodeId}`;
      if (node.type !== 'knowledge') return `error:cannot_modify_system_node:${nodeId}`;

      const newContent = node.data.content + (withNewline ? '\n' : '') + text;
      updateKnowledgeNode(nodeId, { content: newContent });
      return `appended:${nodeId}`;
    },
  });

  // 4. Delete Node (BLOCKED for system nodes)
  useCopilotAction({
    name: "deleteNode",
    description: "Delete a knowledge node and all its connected edges.",
    available: "remote",
    parameters: [
      { name: "nodeId", type: "string", required: true },
    ],
    handler: ({ nodeId }: { nodeId: string }) => {
      // Type guard: prevent deletion of system nodes
      if (nodeId === 'form-node' || nodeId === 'email-node') {
        return `error:cannot_delete_system_node:${nodeId}`;
      }

      const existed = knowledgeNodes.some((n) => n.id === nodeId);
      deleteKnowledgeNode(nodeId);
      return existed ? `deleted:${nodeId}` : `not_found:${nodeId}`;
    },
  });

  // 5. Set Node Feedback (ONLY knowledge nodes)
  useCopilotAction({
    name: "setNodeFeedback",
    description: "Set feedback for a knowledge node (like, dislike, or neutral).",
    available: "remote",
    parameters: [
      { name: "nodeId", type: "string", required: true },
      { name: "feedback", type: "string", required: true, description: "'like', 'dislike', or 'neutral'" },
    ],
    handler: ({ nodeId, feedback }: { nodeId: string; feedback: string }) => {
      const node = (viewState.nodes ?? []).find((n) => n.id === nodeId);

      // Type guard
      if (!node) return `error:node_not_found:${nodeId}`;
      if (node.type !== 'knowledge') return `error:cannot_modify_system_node:${nodeId}`;

      const feedbackValue = feedback === "neutral" ? null : (feedback as "like" | "dislike");
      updateKnowledgeNode(nodeId, { feedback: feedbackValue });
      return `feedback_set:${nodeId}:${feedback}`;
    },
  });

  // 6. Create Edge (ONLY between knowledge nodes)
  useCopilotAction({
    name: "createEdge",
    description: "Create an edge between two knowledge nodes.",
    available: "remote",
    parameters: [
      { name: "nodeId1", type: "string", required: true, description: "First node ID" },
      { name: "nodeId2", type: "string", required: true, description: "Second node ID" },
    ],
    handler: ({ nodeId1, nodeId2 }: { nodeId1: string; nodeId2: string }) => {
      const node1 = (viewState.nodes ?? []).find((n) => n.id === nodeId1);
      const node2 = (viewState.nodes ?? []).find((n) => n.id === nodeId2);

      // Type guards
      if (!node1) return `error:node_not_found:${nodeId1}`;
      if (!node2) return `error:node_not_found:${nodeId2}`;
      if (node1.type !== 'knowledge') return `error:cannot_connect_system_node:${nodeId1}`;
      if (node2.type !== 'knowledge') return `error:cannot_connect_system_node:${nodeId2}`;
      if (nodeId1 === nodeId2) return `error:cannot_connect_to_self`;

      // Check for duplicate
      const exists = (viewState.edges ?? []).some((e) =>
        (e.source === nodeId1 && e.target === nodeId2) ||
        (e.source === nodeId2 && e.target === nodeId1)
      );

      if (exists) return `already_exists:${nodeId1}-${nodeId2}`;

      // Deduplication check
      const edgeKey = [nodeId1, nodeId2].sort().join('-');
      const now = Date.now();
      const recentTime = lastEdgeCreationRef.current[edgeKey];
      if (recentTime && now - recentTime < 2000) {
        return `duplicate_prevented:${edgeKey}`;
      }

      // Create edge
      let createdId = "";
      setState((prev) => {
        const base = prev ?? initialState;
        const [id1, id2] = [nodeId1, nodeId2].sort();
        createdId = `e-${id1}-${id2}`;

        const newEdge: KGEdge = {
          id: createdId,
          source: nodeId1,
          target: nodeId2,
          relationship: 'relates to',  // Default relationship for agent-created edges
        };

        return {
          ...base,
          edges: [...(base.edges ?? []), newEdge],
          lastAction: `edge_created:${createdId}`,
        } as AgentState;
      });

      lastEdgeCreationRef.current[edgeKey] = now;
      return createdId;
    },
  });

  // 7. Delete Edge (ONLY between knowledge nodes)
  useCopilotAction({
    name: "deleteEdge",
    description: "Remove an edge between two knowledge nodes.",
    available: "remote",
    parameters: [
      { name: "nodeId1", type: "string", required: true },
      { name: "nodeId2", type: "string", required: true },
    ],
    handler: ({ nodeId1, nodeId2 }: { nodeId1: string; nodeId2: string }) => {
      const existed = (viewState.edges ?? []).some((e) =>
        (e.source === nodeId1 && e.target === nodeId2) ||
        (e.source === nodeId2 && e.target === nodeId1)
      );

      setState((prev) => {
        const base = prev ?? initialState;
        const edges = (base.edges ?? []).filter((e) =>
          !(
            (e.source === nodeId1 && e.target === nodeId2) ||
            (e.source === nodeId2 && e.target === nodeId1)
          )
        );
        return { ...base, edges } as AgentState;
      });

      return existed ? `deleted:${nodeId1}-${nodeId2}` : `not_found:${nodeId1}-${nodeId2}`;
    },
  });

  // 8. Generate Knowledge Graph (Workflow action)
  useCopilotAction({
    name: "generateKnowledgeGraph",
    description: "Generate a knowledge graph from the product and customer descriptions in the form. This triggers the KG generation workflow.",
    available: "remote",
    parameters: [],
    handler: async () => {
      // Validate form data exists
      if (!formNode) {
        return "error:form_node_not_found";
      }

      const { productDescription, customerDescription } = formNode.data;

      // Validation
      if (!productDescription?.trim() || !customerDescription?.trim()) {
        return "error:missing_descriptions - Please ensure both product and customer descriptions are filled in the form first";
      }

      if (isGeneratingKG) {
        return "error:already_generating - KG generation is already in progress";
      }

      // Trigger the generation
      try {
        handleGenerateKG();
        return "success:kg_generation_started - Knowledge graph generation has been triggered. This will take a few moments.";
      } catch (error) {
        return `error:generation_failed - ${error}`;
      }
    },
  });

  // 9. Generate Email Draft (Workflow action)
  useCopilotAction({
    name: "generateEmailDraft",
    description: "Generate an email draft from the current knowledge graph. Requires at least one knowledge node to exist. This triggers the email generation workflow which calls the backend CoDreamer system.",
    available: "remote",
    parameters: [],
    handler: async () => {
      // Validate email node exists
      if (!emailNode) {
        return "error:email_node_not_found";
      }

      // Validation
      if (knowledgeNodes.length === 0) {
        return "error:no_knowledge_nodes - Please generate or create knowledge nodes first before generating an email";
      }

      if (isGeneratingEmail) {
        return "error:already_generating - Email generation is already in progress";
      }

      // Trigger the generation
      try {
        handleGenerateEmail();
        return "success:email_generation_started - Email generation has been triggered. The backend is processing the knowledge graph and will return results shortly (up to 60 seconds).";
      } catch (error) {
        return `error:generation_failed - ${error}`;
      }
    },
  });

  // 10. Update Form Fields (Workflow action)
  useCopilotAction({
    name: "updateFormFields",
    description: "Update the product description and/or customer description in the input form. Use this to help users fill out the form or make corrections.",
    available: "remote",
    parameters: [
      { name: "productDescription", type: "string", required: false, description: "Product description text (leave empty to keep current value)" },
      { name: "customerDescription", type: "string", required: false, description: "Customer description text (leave empty to keep current value)" },
    ],
    handler: ({ productDescription, customerDescription }: { productDescription?: string; customerDescription?: string }) => {
      if (!formNode) {
        return "error:form_node_not_found";
      }

      // Build update object with only provided fields
      const updates: Partial<typeof formNode.data> = {};
      if (productDescription !== undefined && productDescription.trim()) {
        updates.productDescription = productDescription.trim();
      }
      if (customerDescription !== undefined && customerDescription.trim()) {
        updates.customerDescription = customerDescription.trim();
      }

      if (Object.keys(updates).length === 0) {
        return "error:no_updates - Please provide at least one field to update";
      }

      // Update form node
      setState((prev) => {
        const base = prev ?? initialState;
        const nodes = (base.nodes ?? []).map((n) => {
          if (n.id === 'form-node' && n.type === 'form') {
            return { ...n, data: { ...n.data, ...updates } } as FNode;
          }
          return n;
        });
        return { ...base, nodes, lastAction: 'form_updated' } as AgentState;
      });

      const updatedFields = Object.keys(updates).join(', ');
      return `success:form_updated - Updated: ${updatedFields}`;
    },
  });

  // 11. Summarize Outreach Pipeline (Analytics action)
  useCopilotAction({
    name: "summarizePipeline",
    description: "Generate a comprehensive summary of the current outreach pipeline, including customer statuses, workflow progress, and completion rates. Use this when the user asks about pipeline status, outreach stats, or progress overview.",
    available: "remote",
    parameters: [],
    handler: () => {
      const totalCustomers = customers.length;
      const statusCounts = {
        new: customers.filter(c => c.status === 'new').length,
        sent: customers.filter(c => c.status === 'sent').length,
        opened: customers.filter(c => c.status === 'opened').length,
        inConvo: customers.filter(c => c.status === 'in convo').length,
      };

      const workflowCounts = {
        step1: Object.values(customerStates).filter(s => s.currentStep === 1).length,
        step2: Object.values(customerStates).filter(s => s.currentStep === 2).length,
        step3: Object.values(customerStates).filter(s => s.currentStep === 3).length,
      };

      const customersWithKG = Object.values(customerStates).filter(state =>
        state.nodes?.some(n => n.type === 'knowledge')
      ).length;

      const customersWithEmail = Object.values(customerStates).filter(state =>
        state.nodes?.some(n => n.id === 'email-node' && n.type === 'email' && n.data.emailText)
      ).length;

      const completionRate = totalCustomers > 0 ? ((customersWithEmail / totalCustomers) * 100).toFixed(1) : '0';

      const summary = [
        `📊 OUTREACH PIPELINE SUMMARY`,
        ``,
        `Total Customers: ${totalCustomers}`,
        `Currently Selected: ${customers.find(c => c.id === selectedCustomerId)?.name || 'None'}`,
        ``,
        `📈 Status Breakdown:`,
        `  • New: ${statusCounts.new} (${totalCustomers > 0 ? ((statusCounts.new / totalCustomers) * 100).toFixed(0) : 0}%)`,
        `  • Sent: ${statusCounts.sent} (${totalCustomers > 0 ? ((statusCounts.sent / totalCustomers) * 100).toFixed(0) : 0}%)`,
        `  • Opened: ${statusCounts.opened} (${totalCustomers > 0 ? ((statusCounts.opened / totalCustomers) * 100).toFixed(0) : 0}%)`,
        `  • In Convo: ${statusCounts.inConvo} (${totalCustomers > 0 ? ((statusCounts.inConvo / totalCustomers) * 100).toFixed(0) : 0}%)`,
        ``,
        `🔄 Workflow Progress:`,
        `  • Step 1 (Form Input): ${workflowCounts.step1}`,
        `  • Step 2 (KG Editing): ${workflowCounts.step2}`,
        `  • Step 3 (Email Review): ${workflowCounts.step3}`,
        ``,
        `✅ Completion Metrics:`,
        `  • Customers with Knowledge Graph: ${customersWithKG}/${totalCustomers}`,
        `  • Customers with Generated Email: ${customersWithEmail}/${totalCustomers}`,
        `  • Overall Completion Rate: ${completionRate}%`,
      ].join('\n');

      return summary;
    },
  });

  // 12. Autopilot Mode - Generate KG and Email automatically
  useCopilotAction({
    name: "runAutopilot",
    description: "Autopilot mode: Automatically generate the knowledge graph from form data, then generate the email once KG is ready. This runs the full workflow end-to-end.",
    available: "remote",
    parameters: [],
    handler: async () => {
      // Validate form data exists
      if (!formNode) {
        return "error:form_node_not_found";
      }

      const { productDescription, customerDescription } = formNode.data;

      // Validation
      if (!productDescription?.trim() || !customerDescription?.trim()) {
        return "error:missing_descriptions - Please fill in both product and customer descriptions first";
      }

      if (isGeneratingKG || isGeneratingEmail) {
        return "error:already_generating - A generation process is already in progress";
      }

      try {
        // Step 1: Generate KG
        await handleGenerateKG();

        // Step 2: Wait for React state to update, then generate email
        // Use setTimeout to ensure the component re-renders with new knowledge nodes
        setTimeout(async () => {
          console.log('[Autopilot] KG generation complete, now triggering email generation...');
          await handleGenerateEmail();
        }, 2000); // Wait 2 seconds for state propagation and re-render

        return "success:autopilot_started - Autopilot mode activated! I'm generating the knowledge graph first. Once that's complete, I'll automatically generate the email. This will take about 60-90 seconds total.";
      } catch (error) {
        return `error:autopilot_failed - ${error}`;
      }
    },
  });

  // AGENT INSTRUCTIONS
  useCopilotAdditionalInstructions({
    instructions: (() => {
      const kgNodes = knowledgeNodes;
      const edges = viewState.edges ?? [];

      const nodeSummary = kgNodes
        .map(n => {
          const verificationInfo = n.data.verification
            ? ` [Tavily: ${(n.data.verification.confidence * 100).toFixed(0)}% confident, ${n.data.verification.sources.length} sources]`
            : '';
          return `${n.id}: "${n.data.content.substring(0, 40)}..." [${n.data.feedback ?? "neutral"}]${verificationInfo}`;
        })
        .join('\n');

      const formState = formNode ? [
        "FORM DATA:",
        `Product Description: ${formNode.data.productDescription ? `"${formNode.data.productDescription.substring(0, 60)}..."` : "(empty)"}`,
        `Customer Description: ${formNode.data.customerDescription ? `"${formNode.data.customerDescription.substring(0, 60)}..."` : "(empty)"}`,
        "",
      ] : [];

      return [
        `CURRENT WORKFLOW STEP: ${viewState.currentStep} of 3`,
        "",
        ...formState,
        "KNOWLEDGE GRAPH - CURRENT STATE:",
        `Knowledge Nodes (${kgNodes.length}):`,
        nodeSummary || "(no knowledge nodes yet)",
        "",
        `Edges (${edges.length}):`,
        edges.map(e => `${e.source} ↔ ${e.target}`).join(', ') || "(no edges)",
        "",
        "IMPORTANT: You can ONLY modify knowledge nodes (type='knowledge').",
        "System nodes (form-node, email-node) are protected and cannot be modified.",
        "",
        "AVAILABLE ACTIONS:",
        "",
        "Knowledge Graph Actions:",
        "- createNode(content) → creates type='knowledge' node",
        "- updateNodeContent(nodeId, content) → only for knowledge nodes",
        "- appendNodeContent(nodeId, text, withNewline?)",
        "- deleteNode(nodeId) → blocked for form/email nodes",
        "- setNodeFeedback(nodeId, feedback)",
        "- createEdge(nodeId1, nodeId2) → only between knowledge nodes",
        "- deleteEdge(nodeId1, nodeId2)",
        "",
        "Workflow Actions:",
        "- updateFormFields(productDescription?, customerDescription?) → update form inputs",
        "- generateKnowledgeGraph() → triggers KG generation from form data",
        "- generateEmailDraft() → triggers email generation from current KG",
        "",
        "Analytics Actions:",
        "- summarizePipeline() → generate comprehensive outreach pipeline summary",
        "",
        "Autopilot Action:",
        "- runAutopilot() → automatically run KG generation + email generation end-to-end",
        "",
        "PIPELINE VISIBILITY:",
        "You have access to the full customer pipeline via readable context, including:",
        "- All customers with their status (new/sent/opened/in convo)",
        "- Workflow progress for each customer (which step they're on)",
        "- Completion metrics (who has KG, who has email generated)",
        "",
        "EXAMPLES:",
        "- ✅ GOOD: updateNodeContent('kg-1', 'Updated content')",
        "- ✅ GOOD: createNode('New insight about product')",
        "- ✅ GOOD: updateFormFields(productDescription='Our AI-powered analytics tool')",
        "- ✅ GOOD: generateKnowledgeGraph() → when user fills in form",
        "- ✅ GOOD: generateEmailDraft() → when KG is ready",
        "- ✅ GOOD: runAutopilot() → for full workflow automation",
        "- ✅ GOOD: summarizePipeline() → when user asks about pipeline status",
        "- ❌ BAD: updateNodeContent('form-node', '...') → will fail",
        "- ❌ BAD: deleteNode('email-node') → will fail",
      ].join('\n');
    })(),
  });

  // Validation for Generate KG button
  const canGenerateKG = Boolean(
    formNode &&
    formNode.data.productDescription.trim() &&
    formNode.data.customerDescription.trim() &&
    !isGeneratingKG
  );

  // Validation for Generate Email button
  const canGenerateEmail = knowledgeNodes.length > 0 && !isGeneratingEmail;

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Far Left: Customer List Panel - Resizable */}
        <aside className="max-md:hidden" style={{ width: `${customerListWidth}px` }}>
          <CustomerListPanel
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={handleSelectCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onAddCustomer={handleAddCustomer}
            onWidthChange={setCustomerListWidth}
          />
        </aside>

        {/* Left: Step Panel with Form/Email - Resizable */}
        <aside className="max-md:hidden" style={{ width: `${sidebarWidth}px` }}>
          <StepPanel
            currentStep={viewState.currentStep}
            isGeneratingKG={isGeneratingKG}
            isGeneratingEmail={isGeneratingEmail}
            canGenerateKG={canGenerateKG}
            canGenerateEmail={canGenerateEmail}
            onGenerateKG={handleGenerateKG}
            onGenerateEmail={handleGenerateEmail}
            formData={formNode?.data}
            onFormUpdate={(updates) => {
              if (formNode) {
                setState((prev) => {
                  const base = prev ?? initialState;
                  const nodes = (base.nodes ?? []).map((n) => {
                    if (n.id === 'form-node' && n.type === 'form') {
                      return { ...n, data: { ...n.data, ...updates } } as FNode;
                    }
                    return n;
                  });
                  return { ...base, nodes } as AgentState;
                });
              }
            }}
            emailData={emailNode?.data}
            onEmailUpdate={(updates) => {
              if (emailNode) {
                setState((prev) => {
                  const base = prev ?? initialState;
                  const nodes = (base.nodes ?? []).map((n) => {
                    if (n.id === 'email-node' && n.type === 'email') {
                      return { ...n, data: { ...n.data, ...updates } } as ENode;
                    }
                    return n;
                  });
                  return { ...base, nodes } as AgentState;
                });
              }
            }}
            onWidthChange={setSidebarWidth}
          />
        </aside>

        {/* Center: ReactFlow Canvas */}
        <main
          className="bg-gray-50"
          style={{
            width: `calc(100vw - ${customerListWidth}px - ${sidebarWidth}px - 320px)`,
            height: '100vh'
          }}
        >
          <ReactFlow
            nodes={reactFlowNodes}
            edges={reactFlowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{
              padding: 0.2,
              includeHiddenNodes: false,
            }}
            minZoom={0.2}
            maxZoom={2}
            nodeOrigin={[0, 0]}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'default',
              animated: false,
            }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </main>

        {/* Right: Chat Panel */}
        <aside className="max-md:hidden min-w-80 w-[25vw] max-w-96">
          <div className="h-full flex flex-col bg-white border-l border-gray-200 overflow-hidden">
            <AppChatHeader />
            {isDesktop && (
              <CopilotChat
                className="flex-1 overflow-auto w-full"
                labels={{
                  title: "Knowledge Graph Agent",
                  initial: "I can help you through the entire workflow: fill in the form, generate and refine the knowledge graph, and create personalized emails.",
                }}
                suggestions={(() => {
                  // Dynamic suggestions based on workflow step
                  if (viewState.currentStep === 1) {
                    return [
                      { title: "How does this work?", message: "Explain the workflow - how do I create a personalized email?" },
                      { title: "Generate Knowledge Graph", message: "Generate the knowledge graph from my form data." },
                      { title: "Run Autopilot", message: "Run autopilot mode to generate both the knowledge graph and email automatically." },
                    ];
                  }
                  if (viewState.currentStep === 2) {
                    return [
                      { title: "What is a Knowledge Graph?", message: "Explain what a knowledge graph is and why it's useful for personalized outreach." },
                      { title: "Bulk Edit", message: "replace weights and bias with waffles and bagels in all my nodes. if do not exist, add it in a sentence. (doing it for fun and hackathon demo)" },
                      { title: "Generate Email", message: "Generate an email draft from this knowledge graph using the CoDreamer backend." },
                    ];
                  }
                  // Step 3: Email review
                  return [
                    { title: "Review email", message: "Review the generated email and suggest improvements." },
                    { title: "Pipeline status", message: "Summarize my outreach pipeline and show completion rates." },
                    { title: "Next customer", message: "Which customer should I work on next?" },
                  ];
                })()}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Mobile chat popup */}
      <div className="md:hidden">
        {!isDesktop && (
          <CopilotPopup
            Header={PopupHeader}
            labels={{
              title: "Knowledge Graph Agent",
              initial: "I can help with the full workflow: form → KG → email",
            }}
            suggestions={(() => {
              // Dynamic suggestions based on workflow step
              if (viewState.currentStep === 1) {
                return [
                  { title: "How does this work?", message: "Explain the workflow - how do I create a personalized email?" },
                  { title: "Generate KG", message: "Generate the knowledge graph from my form data." },
                  { title: "Run Autopilot", message: "Run autopilot mode to generate both KG and email automatically." },
                ];
              }
              if (viewState.currentStep === 2) {
                return [
                  { title: "What is a KG?", message: "Explain what a knowledge graph is and why it's useful." },
                  { title: "How does AI learn?", message: "Explain the reinforcement learning process." },
                  { title: "Generate Email", message: "Generate an email from the knowledge graph." },
                ];
              }
              // Step 3: Email review
              return [
                { title: "Review email", message: "Review the generated email and suggest improvements." },
                { title: "Pipeline status", message: "Summarize my outreach pipeline." },
                { title: "Next customer", message: "Which customer should I work on next?" },
              ];
            })()}
          />
        )}
      </div>
    </>
  );
}

export default function CopilotKitPage() {
  return (
    <div
      style={{ "--copilot-kit-primary-color": "#2563eb" } as CopilotKitCSSProperties}
      className="h-screen flex flex-col"
    >
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
