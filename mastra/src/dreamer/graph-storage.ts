import { createClient } from '@libsql/client';
import { v4 as uuidv4 } from 'uuid';
import { Node } from './types';

export interface StoredGraph {
  id: string;
  customer: string;
  product: string;
  nodes: Node[];
  nodeCount: number;
  generationTimeMs: number;
  createdAt: string;
  metadata?: {
    childrenCount?: number;
    generationsCount?: number;
    implementation?: 'workflow' | 'legacy';
  };
}

export interface GraphFilter {
  customer?: string;
  product?: string;
  limit?: number;
  offset?: number;
}

export class GraphStorageService {
  private client: ReturnType<typeof createClient>;
  private tableName = 'knowledge_graphs';

  constructor(dbPath: string = './data/graphs.db') {
    this.client = createClient({
      url: `file:${dbPath}`,
    });
  }

  async initialize(): Promise<void> {
    // Create table if it doesn't exist
    try {
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          customer TEXT NOT NULL,
          product TEXT NOT NULL,
          nodes TEXT NOT NULL,
          node_count INTEGER NOT NULL,
          generation_time_ms INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          metadata TEXT,
          UNIQUE(customer, product, created_at)
        )
      `);

      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graphs_customer
          ON ${this.tableName}(customer)
      `);

      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graphs_product
          ON ${this.tableName}(product)
      `);

      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graphs_created
          ON ${this.tableName}(created_at DESC)
      `);

      console.log('[GraphStorage] Initialized database and tables');
    } catch (error) {
      console.error('[GraphStorage] Failed to initialize:', error);
      throw error;
    }
  }

  async saveGraph(params: {
    customer: string;
    product: string;
    nodes: Node[];
    generationTimeMs: number;
    metadata?: StoredGraph['metadata'];
  }): Promise<StoredGraph> {
    const graph: StoredGraph = {
      id: uuidv4(),
      customer: params.customer,
      product: params.product,
      nodes: params.nodes,
      nodeCount: params.nodes.length,
      generationTimeMs: params.generationTimeMs,
      createdAt: new Date().toISOString(),
      metadata: params.metadata,
    };

    const insertSQL = `
      INSERT INTO ${this.tableName}
        (id, customer, product, nodes, node_count, generation_time_ms, created_at, metadata)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.client.execute({
        sql: insertSQL,
        args: [
          graph.id,
          graph.customer,
          graph.product,
          JSON.stringify(graph.nodes),
          graph.nodeCount,
          graph.generationTimeMs,
          graph.createdAt,
          graph.metadata ? JSON.stringify(graph.metadata) : null,
        ],
      });

      console.log(`[GraphStorage] Saved graph ${graph.id} with ${graph.nodeCount} nodes`);
      return graph;
    } catch (error) {
      console.error('[GraphStorage] Failed to save graph:', error);
      throw error;
    }
  }

  async getGraph(id: string): Promise<StoredGraph | null> {
    const selectSQL = `
      SELECT * FROM ${this.tableName} WHERE id = ?
    `;

    try {
      const result = await this.client.execute({
        sql: selectSQL,
        args: [id],
      });

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return this.parseGraphRow(result.rows[0]);
    } catch (error) {
      console.error('[GraphStorage] Failed to get graph:', error);
      throw error;
    }
  }

  async listGraphs(filter: GraphFilter = {}): Promise<StoredGraph[]> {
    const { customer, product, limit = 10, offset = 0 } = filter;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (customer) {
      whereConditions.push('customer LIKE ?');
      params.push(`%${customer}%`);
    }

    if (product) {
      whereConditions.push('product LIKE ?');
      params.push(`%${product}%`);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const selectSQL = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    try {
      const result = await this.client.execute({
        sql: selectSQL,
        args: params,
      });
      return result.rows.map((row: any) => this.parseGraphRow(row));
    } catch (error) {
      console.error('[GraphStorage] Failed to list graphs:', error);
      throw error;
    }
  }

  async countGraphs(filter: GraphFilter = {}): Promise<number> {
    const { customer, product } = filter;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (customer) {
      whereConditions.push('customer LIKE ?');
      params.push(`%${customer}%`);
    }

    if (product) {
      whereConditions.push('product LIKE ?');
      params.push(`%${product}%`);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const countSQL = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      ${whereClause}
    `;

    try {
      const result = await this.client.execute({
        sql: countSQL,
        args: params,
      });
      return Number(result.rows[0]?.count || 0);
    } catch (error) {
      console.error('[GraphStorage] Failed to count graphs:', error);
      throw error;
    }
  }

  async deleteGraph(id: string): Promise<boolean> {
    const deleteSQL = `
      DELETE FROM ${this.tableName} WHERE id = ?
    `;

    try {
      await this.client.execute({
        sql: deleteSQL,
        args: [id],
      });
      console.log(`[GraphStorage] Deleted graph ${id}`);
      return true;
    } catch (error) {
      console.error('[GraphStorage] Failed to delete graph:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalGraphs: number;
    totalNodes: number;
    avgNodesPerGraph: number;
    avgGenerationTime: number;
  }> {
    const statsSQL = `
      SELECT
        COUNT(*) as total_graphs,
        SUM(node_count) as total_nodes,
        AVG(node_count) as avg_nodes,
        AVG(generation_time_ms) as avg_time
      FROM ${this.tableName}
    `;

    try {
      const result = await this.client.execute(statsSQL);
      const stats = result.rows[0];

      return {
        totalGraphs: Number(stats.total_graphs || 0),
        totalNodes: Number(stats.total_nodes || 0),
        avgNodesPerGraph: Math.round(Number(stats.avg_nodes || 0)),
        avgGenerationTime: Math.round(Number(stats.avg_time || 0)),
      };
    } catch (error) {
      console.error('[GraphStorage] Failed to get stats:', error);
      throw error;
    }
  }

  private parseGraphRow(row: any): StoredGraph {
    return {
      id: row.id,
      customer: row.customer,
      product: row.product,
      nodes: JSON.parse(row.nodes),
      nodeCount: row.node_count,
      generationTimeMs: row.generation_time_ms,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  async close(): Promise<void> {
    // LibSQL handles connection pooling, no explicit close needed
    console.log('[GraphStorage] Closed');
  }
}
