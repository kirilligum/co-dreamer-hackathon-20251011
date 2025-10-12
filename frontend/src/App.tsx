import { useState } from 'react';
import DreamForm from './components/DreamForm';
import KnowledgeGraph from './components/KnowledgeGraph';
import { dreamerAPI } from './api';
import type { DreamRequest, Node } from './types';
import './App.css';

function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ duration: number; nodeCount: number } | null>(null);

  const handleDreamSubmit = async (request: DreamRequest) => {
    setIsLoading(true);
    setError(null);
    setStats(null);

    const startTime = Date.now();

    try {
      const result = await dreamerAPI.generateKnowledgeGraph(request);
      const duration = Date.now() - startTime;

      setNodes(result);
      setStats({
        duration,
        nodeCount: result.length,
      });
    } catch (err) {
      console.error('Error generating knowledge graph:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate knowledge graph. Is the backend running?'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🌟 Knowledge Dreamer</h1>
        <p className="subtitle">
          Autonomous Knowledge Graph Expansion for Product-Market Fit Discovery
        </p>
      </header>

      <main className="app-main">
        <div className="form-section">
          <h2>Configure Dream</h2>
          <DreamForm onSubmit={handleDreamSubmit} isLoading={isLoading} />
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {stats && (
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-label">Nodes Generated:</span>
              <span className="stat-value">{stats.nodeCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Duration:</span>
              <span className="stat-value">{(stats.duration / 1000).toFixed(2)}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg per Node:</span>
              <span className="stat-value">
                {(stats.duration / stats.nodeCount / 1000).toFixed(2)}s
              </span>
            </div>
          </div>
        )}

        {nodes.length > 0 && (
          <div className="graph-section">
            <h2>Knowledge Graph Visualization</h2>
            <div className="graph-container">
              <KnowledgeGraph nodes={nodes} />
            </div>
            <div className="graph-info">
              <p>
                💡 <strong>Tip:</strong> Click on nodes to see full content. Drag to pan, scroll
                to zoom.
              </p>
            </div>
          </div>
        )}

        {!isLoading && nodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>Ready to Dream</h3>
            <p>
              Fill out the form above and click "Generate Dream" to create a knowledge graph
              exploring connections between your customer and product.
            </p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Code Dreamer Project - Hackathon 2025</p>
      </footer>
    </div>
  );
}

export default App;
