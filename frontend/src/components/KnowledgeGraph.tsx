import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  type Node as FlowNode,
  type Edge as FlowEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node } from '../types';

interface KnowledgeGraphProps {
  nodes: Node[];
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ nodes }) => {
  // Convert our graph nodes to React Flow format
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    // Calculate positions using a simple tree layout
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    // BFS to determine levels - start from "Customer Job" anchor node
    const queue: { id: string; level: number }[] = [{ id: 'Customer Job', level: 0 }];
    const nodesAtLevel = new Map<number, string[]>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;

      visited.add(id);
      levels.set(id, level);

      if (!nodesAtLevel.has(level)) {
        nodesAtLevel.set(level, []);
      }
      nodesAtLevel.get(level)!.push(id);

      const node = nodeMap.get(id);
      if (node) {
        node.edge.forEach((edge) => {
          if (!visited.has(edge.target_id)) {
            queue.push({ id: edge.target_id, level: level + 1 });
          }
        });
      }
    }

    // Create React Flow nodes
    const fNodes: FlowNode[] = [];
    const horizontalSpacing = 400;
    const verticalSpacing = 150;

    levels.forEach((level, nodeId) => {
      const nodesInLevel = nodesAtLevel.get(level) || [];
      const indexInLevel = nodesInLevel.indexOf(nodeId);
      const totalInLevel = nodesInLevel.length;

      const node = nodeMap.get(nodeId);
      if (node) {
        const isCustomerJob = nodeId === 'Customer Job';
        const isProductFeature = nodeId === 'Product Feature';
        const isAnchorNode = isCustomerJob || isProductFeature;

        // Determine verification status colors
        const verification = node.verification;
        let verificationBorderColor = '#6366f1'; // default blue
        let verificationBadgeColor = '#9ca3af'; // gray for no verification
        let verificationIcon = '?';

        if (verification) {
          if (verification.verified && verification.confidence >= 0.7) {
            verificationBorderColor = '#10b981'; // green for high confidence
            verificationBadgeColor = '#10b981';
            verificationIcon = '✓';
          } else if (verification.verified && verification.confidence >= 0.5) {
            verificationBorderColor = '#f59e0b'; // amber for medium confidence
            verificationBadgeColor = '#f59e0b';
            verificationIcon = '~';
          } else {
            verificationBorderColor = '#ef4444'; // red for unverified
            verificationBadgeColor = '#ef4444';
            verificationIcon = '✗';
          }
        }

        fNodes.push({
          id: nodeId,
          type: isCustomerJob ? 'input' : isProductFeature ? 'output' : 'default',
          data: {
            label: (
              <div style={{ padding: '10px', maxWidth: '250px', position: 'relative' }}>
                {/* Verification badge */}
                {verification && !isAnchorNode && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: verificationBadgeColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}>
                    {verificationIcon}
                  </div>
                )}
                <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
                  {isCustomerJob ? 'Customer Job' : isProductFeature ? 'Product Feature' : nodeId.split('-').slice(0, -1).join(' ')}
                </div>
                <div style={{ fontSize: '11px', color: isAnchorNode ? '#ffffff' : '#666' }}>
                  {node.content.substring(0, 100)}
                  {node.content.length > 100 ? '...' : ''}
                </div>
                {/* Confidence indicator */}
                {verification && !isAnchorNode && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    color: isAnchorNode ? '#ffffff' : '#888',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>Confidence:</span>
                    <div style={{
                      flex: 1,
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${verification.confidence * 100}%`,
                        backgroundColor: verificationBadgeColor,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <span>{(verification.confidence * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )
          },
          position: {
            x: (indexInLevel - (totalInLevel - 1) / 2) * horizontalSpacing,
            y: level * verticalSpacing,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          style: {
            background: isCustomerJob ? '#6366f1' : isProductFeature ? '#10b981' : '#ffffff',
            color: isAnchorNode ? '#ffffff' : '#000000',
            border: isAnchorNode ? '3px solid' : '2px solid',
            borderColor: isAnchorNode
              ? (isCustomerJob ? '#4f46e5' : '#059669')
              : verificationBorderColor,
            borderRadius: '8px',
            padding: '0',
            width: 'auto',
            minWidth: '200px',
          },
        });
      }
    });

    // Create React Flow edges
    const fEdges: FlowEdge[] = [];
    nodes.forEach((node) => {
      node.edge.forEach((edge, index) => {
        fEdges.push({
          id: `${node.id}-${edge.target_id}-${index}`,
          source: node.id,
          target: edge.target_id,
          label: edge.relationship,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6366f1',
          },
          style: {
            stroke: '#6366f1',
            strokeWidth: 2,
          },
          labelStyle: {
            fontSize: 10,
            fontWeight: 500,
            fill: '#4b5563',
          },
          labelBgStyle: {
            fill: '#ffffff',
            fillOpacity: 0.9,
          },
        });
      });
    });

    return { flowNodes: fNodes, flowEdges: fEdges };
  }, [nodes]);

  const [reactFlowNodes, , onNodesChange] = useNodesState(flowNodes);
  const [reactFlowEdges, , onEdgesChange] = useEdgesState(flowEdges);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: FlowNode) => {
    const originalNode = nodes.find((n) => n.id === node.id);
    if (originalNode) {
      let alertMessage = `Node: ${node.id}\n\nContent: ${originalNode.content}\n\nOutgoing connections: ${originalNode.edge.length}`;

      // Add verification information if available
      if (originalNode.verification) {
        const v = originalNode.verification;
        alertMessage += `\n\n--- Verification ---`;
        alertMessage += `\nStatus: ${v.verified ? '✓ VERIFIED' : '✗ UNVERIFIED'}`;
        alertMessage += `\nConfidence: ${(v.confidence * 100).toFixed(1)}%`;
        alertMessage += `\nSummary: ${v.summary}`;
        if (v.sources.length > 0) {
          alertMessage += `\n\nSources (${v.sources.length}):`;
          v.sources.slice(0, 3).forEach((source, i) => {
            alertMessage += `\n${i + 1}. ${source}`;
          });
          if (v.sources.length > 3) {
            alertMessage += `\n... and ${v.sources.length - 3} more`;
          }
        }
        alertMessage += `\n\nVerified at: ${new Date(v.timestamp).toLocaleString()}`;
      }

      alert(alertMessage);
    }
  }, [nodes]);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.id === 'Customer Job') return '#6366f1';
            if (node.id === 'Product Feature') return '#10b981';
            return '#e5e7eb';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};

export default KnowledgeGraph;
