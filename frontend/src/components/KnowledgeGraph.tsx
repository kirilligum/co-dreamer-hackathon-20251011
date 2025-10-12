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

        fNodes.push({
          id: nodeId,
          type: isCustomerJob ? 'input' : isProductFeature ? 'output' : 'default',
          data: {
            label: (
              <div style={{ padding: '10px', maxWidth: '250px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
                  {isCustomerJob ? 'Customer Job' : isProductFeature ? 'Product Feature' : nodeId.split('-').slice(0, -1).join(' ')}
                </div>
                <div style={{ fontSize: '11px', color: isAnchorNode ? '#ffffff' : '#666' }}>
                  {node.content.substring(0, 100)}
                  {node.content.length > 100 ? '...' : ''}
                </div>
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
            border: isAnchorNode ? '3px solid' : '2px solid #6366f1',
            borderColor: isCustomerJob ? '#4f46e5' : isProductFeature ? '#059669' : '#6366f1',
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
      alert(
        `Node: ${node.id}\n\nContent: ${originalNode.content}\n\nOutgoing connections: ${originalNode.edge.length}`
      );
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
