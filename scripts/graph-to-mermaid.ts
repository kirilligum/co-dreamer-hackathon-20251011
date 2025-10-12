#!/usr/bin/env node

/**
 * Convert Knowledge Graph JSON to Mermaid Diagram
 *
 * Usage: node graph-to-mermaid.ts <input.json> [output.mmd]
 */

import * as fs from 'fs';
import * as path from 'path';

interface Edge {
  target_id: string;
  relationship: string;
  rationale: string;
}

interface Node {
  id: string;
  content: string;
  edge: Edge[];
}

function sanitizeForMermaid(text: string, maxLength: number = 50): string {
  // Remove special characters that break Mermaid
  let sanitized = text
    .replace(/["\[\]{}()]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

function getNodeLabel(node: Node): string {
  if (node.id === 'Customer Job') {
    return 'Customer Job: ' + sanitizeForMermaid(node.content, 40);
  } else if (node.id === 'Product Feature') {
    return 'Product Feature: ' + sanitizeForMermaid(node.content, 40);
  } else {
    // Extract the descriptive part of the ID (before the UUID)
    const namePart = node.id.split('-').slice(0, -1).join(' ');
    return sanitizeForMermaid(namePart, 30);
  }
}

function generateMermaid(nodes: Node[]): string {
  const lines: string[] = [];

  // Start with graph definition
  lines.push('graph TB');
  lines.push('');

  // Define node styles
  lines.push('  %% Node Styles');
  lines.push('  classDef customerClass fill:#6366f1,stroke:#4f46e5,stroke-width:3px,color:#fff');
  lines.push('  classDef productClass fill:#10b981,stroke:#059669,stroke-width:3px,color:#fff');
  lines.push('  classDef dreamClass fill:#f3f4f6,stroke:#6366f1,stroke-width:2px');
  lines.push('');

  // Define all nodes
  lines.push('  %% Nodes');
  nodes.forEach(node => {
    const label = getNodeLabel(node);
    // Use sanitized IDs for Mermaid node definitions (no spaces)
    if (node.id === 'Customer Job') {
      lines.push(`  CustomerJob["${label}"]`);
    } else if (node.id === 'Product Feature') {
      lines.push(`  ProductFeature["${label}"]`);
    } else {
      const safeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${safeId}["${label}"]`);
    }
  });
  lines.push('');

  // Apply styles
  lines.push('  %% Apply Styles');
  nodes.forEach(node => {
    if (node.id === 'Customer Job') {
      lines.push(`  class CustomerJob customerClass`);
    } else if (node.id === 'Product Feature') {
      lines.push(`  class ProductFeature productClass`);
    } else {
      // Sanitize node ID for Mermaid class application
      const safeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  class ${safeId} dreamClass`);
    }
  });
  lines.push('');

  // Define edges
  lines.push('  %% Edges');
  nodes.forEach(node => {
    node.edge.forEach(edge => {
      const relationship = sanitizeForMermaid(edge.relationship, 20);

      // Map node IDs to Mermaid-safe IDs
      const sourceId = node.id === 'Customer Job' ? 'CustomerJob' :
                       node.id === 'Product Feature' ? 'ProductFeature' :
                       node.id.replace(/[^a-zA-Z0-9]/g, '_');

      const targetId = edge.target_id === 'Customer Job' ? 'CustomerJob' :
                       edge.target_id === 'Product Feature' ? 'ProductFeature' :
                       edge.target_id.replace(/[^a-zA-Z0-9]/g, '_');

      lines.push(`  ${sourceId} -->|"${relationship}"| ${targetId}`);
    });
  });

  return lines.join('\n');
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node graph-to-mermaid.ts <input.json> [output.mmd]');
  console.error('');
  console.error('Example:');
  console.error('  node graph-to-mermaid.ts knowledge-graph.json diagram.mmd');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace('.json', '.mmd');

try {
  // Read input JSON
  const jsonContent = fs.readFileSync(inputFile, 'utf-8');
  const nodes: Node[] = JSON.parse(jsonContent);

  console.log(`📖 Read ${nodes.length} nodes from ${inputFile}`);

  // Generate Mermaid diagram
  const mermaidDiagram = generateMermaid(nodes);

  // Write output
  fs.writeFileSync(outputFile, mermaidDiagram, 'utf-8');

  console.log(`✅ Generated Mermaid diagram: ${outputFile}`);
  console.log('');
  console.log('To generate PNG:');
  console.log(`  mmdc -i ${outputFile} -o ${outputFile.replace('.mmd', '.png')}`);

} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
