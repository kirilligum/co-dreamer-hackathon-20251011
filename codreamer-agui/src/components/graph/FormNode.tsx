"use client";

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormNodeData } from '@/lib/canvas/types';

export interface FormNodeProps {
  data: FormNodeData;
  onUpdate: (data: Partial<FormNodeData>) => void;
}

function FormNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as FormNodeProps;
  const { data: formData, onUpdate } = nodeData;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-gray-300 p-5 shadow-lg bg-white w-[400px]",
        "relative"
      )}
    >
      {/* Loading overlay */}
      {formData.isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Input Form</h3>
        <p className="text-sm text-gray-500">Step 1: Generate Knowledge Graph</p>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Product Description */}
        <div>
          <label
            htmlFor={`product-desc-${id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Product Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`product-desc-${id}`}
            name={`product-desc-${id}`}
            value={formData.productDescription}
            onChange={(e) => onUpdate({ productDescription: e.target.value })}
            placeholder="Describe your product..."
            className={cn(
              "w-full resize-none rounded-lg border border-gray-300 p-3 text-sm",
              "outline-none placeholder:text-gray-400",
              "hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            )}
            rows={3}
          />
        </div>

        {/* Customer Description */}
        <div>
          <label
            htmlFor={`customer-desc-${id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Customer Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`customer-desc-${id}`}
            name={`customer-desc-${id}`}
            value={formData.customerDescription}
            onChange={(e) => onUpdate({ customerDescription: e.target.value })}
            placeholder="Describe your target customers..."
            className={cn(
              "w-full resize-none rounded-lg border border-gray-300 p-3 text-sm",
              "outline-none placeholder:text-gray-400",
              "hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            )}
            rows={3}
          />
        </div>

        {/* Number Inputs Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Children Count */}
          <div>
            <label
              htmlFor={`children-count-${id}`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Children Count
            </label>
            <input
              id={`children-count-${id}`}
              name={`children-count-${id}`}
              type="number"
              min="1"
              max="10"
              value={formData.childrenCount}
              onChange={(e) => onUpdate({ childrenCount: parseInt(e.target.value, 10) })}
              className={cn(
                "w-full rounded-lg border border-gray-300 p-2 text-sm",
                "outline-none",
                "hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              )}
            />
          </div>

          {/* Generation Count */}
          <div>
            <label
              htmlFor={`generation-count-${id}`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Generation Count
            </label>
            <input
              id={`generation-count-${id}`}
              name={`generation-count-${id}`}
              type="number"
              min="1"
              max="10"
              value={formData.generationCount}
              onChange={(e) => onUpdate({ generationCount: parseInt(e.target.value, 10) })}
              className={cn(
                "w-full rounded-lg border border-gray-300 p-2 text-sm",
                "outline-none",
                "hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const FormNode = memo(FormNodeComponent);
export default FormNode;
