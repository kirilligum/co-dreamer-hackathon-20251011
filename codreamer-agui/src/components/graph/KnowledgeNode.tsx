"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import TextareaAutosize from 'react-textarea-autosize';

export interface KnowledgeNodeData {
  content: string;
  feedback: "like" | "dislike" | null;
  score?: number;  // Node score from CoDreamer (0-1)
  verification?: {
    verified: boolean;
    confidence: number;
    summary: string;
    sources: string[];
    timestamp: string;
  };
  onUpdateContent: (content: string) => void;
  onSetFeedback: (feedback: "like" | "dislike" | null) => void;
  onDelete: () => void;
}

function KnowledgeNodeComponent({ id, data, selected }: NodeProps) {
  const { content, feedback, score, verification, onUpdateContent, onSetFeedback, onDelete } = data as unknown as KnowledgeNodeData;

  // Calculate color intensity based on score (0-1)
  // Low scores: gray/blue, High scores: green
  const getScoreColor = (score: number) => {
    if (score < 0.4) return 'bg-gray-400';
    if (score < 0.6) return 'bg-blue-400';
    if (score < 0.8) return 'bg-green-400';
    return 'bg-green-600';
  };

  const getScoreBorderColor = (score: number) => {
    if (score < 0.4) return 'border-gray-400';
    if (score < 0.6) return 'border-blue-400';
    if (score < 0.8) return 'border-green-400';
    return 'border-green-600';
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 shadow-lg bg-card w-[400px] min-h-[180px]",
        "transition-all ease-out relative",
        feedback === "like" && "border-green-500 bg-green-50",
        feedback === "dislike" && "border-red-500 bg-red-50",
        selected && "ring-4 ring-blue-400 ring-offset-2",
        !feedback && (score !== undefined ? getScoreBorderColor(score) : "border-gray-300"),
        !feedback && "hover:border-accent/40"
      )}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />

      {/* Node ID Badge */}
      <div className="absolute -top-4 -left-4 bg-blue-600 text-white text-lg font-mono px-4 py-1.5 rounded-full shadow-md font-bold">
        {id}
      </div>

      {/* Close Button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
          title="Delete node"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Editable Content */}
      <TextareaAutosize
        id={`node-content-${id}`}
        name={`node-content-${id}`}
        value={content}
        onChange={(e) => onUpdateContent(e.target.value)}
        placeholder="Enter content..."
        className={cn(
          "w-full resize-none rounded-lg border bg-white p-3 text-xl leading-relaxed font-medium",
          "outline-none placeholder:text-gray-400 transition-colors",
          "hover:ring-1 hover:ring-border",
          "focus:ring-2 focus:ring-blue-400 focus:border-blue-400",
          "focus:shadow-sm focus:bg-blue-50/30"
        )}
        minRows={4}
      />

      {/* Citation Blocks - Clickable Sources with Tavily Badge */}
      {verification && verification.sources.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Tavily Verified Badge - Circular Progress */}
            <div className="flex items-center gap-1.5">
              {/* Circular progress indicator */}
              <div className="relative w-8 h-8 flex-shrink-0">
                {/* Background circle */}
                <svg className="w-8 h-8 transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    className="text-gray-200"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 14}`}
                    strokeDashoffset={`${2 * Math.PI * 14 * (1 - verification.confidence)}`}
                    className={cn(
                      "transition-all duration-500",
                      verification.confidence >= 0.8 ? "text-green-500" :
                      verification.confidence >= 0.6 ? "text-blue-500" :
                      "text-yellow-500"
                    )}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Centered text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-gray-700">
                    {Math.round(verification.confidence * 100)}%
                  </span>
                </div>
              </div>
              {/* Tavily label */}
              <span className="text-[10px] font-semibold text-gray-600">
                Tavily
              </span>
            </div>
            <div className="text-xs font-semibold text-gray-500">Sources:</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {verification.sources.map((source, idx) => {
              // Extract domain from URL for display
              let displayText = source;
              try {
                const url = new URL(source);
                displayText = url.hostname.replace('www.', '');
              } catch (e) {
                // If invalid URL, use original
              }

              return (
                <a
                  key={idx}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium",
                    "bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900",
                    "border border-gray-200 rounded-md transition-colors",
                    "hover:shadow-sm cursor-pointer"
                  )}
                  title={source}
                >
                  <span className="font-mono">[{idx + 1}]</span>
                  <span className="truncate max-w-[100px]">{displayText}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Visualization - Horizontal Bar Chart */}
      {score !== undefined && (
        <div className="mt-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 min-w-[60px]">
              Score: {score.toFixed(4)}
            </span>
            {/* Horizontal bar */}
            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out rounded-full bg-gray-800"
                style={{ width: `${score * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Feedback Buttons */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => onSetFeedback(feedback === "like" ? null : "like")}
          className={cn(
            "p-2 rounded-lg hover:bg-green-100 transition-colors",
            feedback === "like" && "bg-green-200 text-green-700 ring-2 ring-green-400"
          )}
          title="Like this node"
        >
          <ThumbsUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => onSetFeedback(feedback === "dislike" ? null : "dislike")}
          className={cn(
            "p-2 rounded-lg hover:bg-red-100 transition-colors",
            feedback === "dislike" && "bg-red-200 text-red-700 ring-2 ring-red-400"
          )}
          title="Dislike this node"
        >
          <ThumbsDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

const KnowledgeNode = memo(KnowledgeNodeComponent);
export default KnowledgeNode;
