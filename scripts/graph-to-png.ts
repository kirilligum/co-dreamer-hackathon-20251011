#!/usr/bin/env node

/**
 * Convert Knowledge Graph JSON directly to PNG and SVG
 *
 * Usage: npx tsx graph-to-png.ts <input.json>
 * Output: <input>.png, <input>.svg, <input>.mmd
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
  console.error('Usage: npx tsx graph-to-png.ts <input.json>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx graph-to-png.ts knowledge-graph.json');
  console.error('  Output: knowledge-graph.png, knowledge-graph.svg, knowledge-graph.mmd');
  process.exit(1);
}

const inputFile = args[0];

// Validate input file
if (!inputFile.endsWith('.json')) {
  console.error('❌ Error: Input file must be a .json file');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: File not found: ${inputFile}`);
  process.exit(1);
}

// Generate output file names
const baseName = inputFile.replace(/\.json$/, '');
const mmdFile = `${baseName}.mmd`;
const pngFile = `${baseName}.png`;
const svgFile = `${baseName}.svg`;

try {
  // Read input JSON
  console.log(`📖 Reading ${inputFile}...`);
  const jsonContent = fs.readFileSync(inputFile, 'utf-8');
  const nodes: Node[] = JSON.parse(jsonContent);
  console.log(`   Found ${nodes.length} nodes`);

  // Generate Mermaid diagram
  console.log(`📝 Generating Mermaid diagram...`);
  const mermaidDiagram = generateMermaid(nodes);
  fs.writeFileSync(mmdFile, mermaidDiagram, 'utf-8');
  console.log(`   Created ${mmdFile}`);

  // Generate PNG using mmdc
  console.log(`🎨 Generating PNG...`);
  execSync(`npx -p @mermaid-js/mermaid-cli mmdc -i ${mmdFile} -o ${pngFile}`, {
    stdio: 'inherit'
  });

  // Generate SVG using mmdc
  console.log(`🎨 Generating SVG...`);
  execSync(`npx -p @mermaid-js/mermaid-cli mmdc -i ${mmdFile} -o ${svgFile}`, {
    stdio: 'inherit'
  });

  console.log('');
  console.log(`✅ Success! Generated:`);
  console.log(`   - ${pngFile}`);
  console.log(`   - ${svgFile}`);
  console.log(`   - ${mmdFile}`);

  // Optionally clean up the intermediate .mmd file
  // fs.unlinkSync(mmdFile);

} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
