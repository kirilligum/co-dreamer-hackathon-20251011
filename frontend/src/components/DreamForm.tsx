import React, { useState } from 'react';
import type { DreamRequest } from '../types';

interface DreamFormProps {
  onSubmit: (request: DreamRequest) => void;
  isLoading: boolean;
}

const DreamForm: React.FC<DreamFormProps> = ({ onSubmit, isLoading }) => {
  const [customer, setCustomer] = useState(
    'Pearls of Wisdom, a company that generates synthetic data sets for training AI models.'
  );
  const [product, setProduct] = useState(
    'Weights and Biases Weave, featuring a UI for feedback and model evaluation.'
  );
  const [childrenCount, setChildrenCount] = useState(2);
  const [generationsCount, setGenerationsCount] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      customer,
      product,
      children_count: childrenCount,
      generations_count_int: generationsCount,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="dream-form">
      <div className="form-group">
        <label htmlFor="customer">
          Customer Description
          <span className="required">*</span>
        </label>
        <textarea
          id="customer"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Describe the customer/company..."
          rows={3}
          required
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="product">
          Product Description
          <span className="required">*</span>
        </label>
        <textarea
          id="product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Describe the target product..."
          rows={3}
          required
          disabled={isLoading}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="childrenCount">
            Children per Node
            <span className="help-text">Number of child nodes generated per parent</span>
          </label>
          <input
            id="childrenCount"
            type="number"
            min="1"
            max="5"
            value={childrenCount}
            onChange={(e) => setChildrenCount(parseInt(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="generationsCount">
            Generations (Depth)
            <span className="help-text">Number of expansion levels</span>
          </label>
          <input
            id="generationsCount"
            type="number"
            min="1"
            max="5"
            value={generationsCount}
            onChange={(e) => setGenerationsCount(parseInt(e.target.value))}
            disabled={isLoading}
          />
        </div>
      </div>

      <button type="submit" className="submit-button" disabled={isLoading}>
        {isLoading ? (
          <>
            <span className="spinner"></span>
            Generating Knowledge Graph...
          </>
        ) : (
          <>
            <span>✨</span>
            Generate Dream
          </>
        )}
      </button>

      <div className="estimated-nodes">
        Estimated nodes: ~{1 + childrenCount * generationsCount * 1.5} nodes
      </div>
    </form>
  );
};

export default DreamForm;
