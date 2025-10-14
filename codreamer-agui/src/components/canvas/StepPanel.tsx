"use client";

import { useState, useRef, useEffect } from 'react';
import { Loader2, CheckCircle2, Circle, FileText, Mail, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import TextareaAutosize from 'react-textarea-autosize';
import type { FormNodeData, EmailNodeData } from '@/lib/canvas/types';
import { DreamerSpinner } from '@/components/ui/DreamerSpinner';

export interface StepPanelProps {
  currentStep: 1 | 2 | 3;
  isGeneratingKG: boolean;
  isGeneratingEmail: boolean;
  canGenerateKG: boolean;
  canGenerateEmail: boolean;
  onGenerateKG: () => void;
  onGenerateEmail: () => void;
  formData?: FormNodeData;
  onFormUpdate?: (updates: Partial<FormNodeData>) => void;
  emailData?: EmailNodeData;
  onEmailUpdate?: (updates: Partial<EmailNodeData>) => void;
  onWidthChange: (width: number) => void;
}

export default function StepPanel({
  currentStep,
  isGeneratingKG,
  isGeneratingEmail,
  canGenerateKG,
  canGenerateEmail,
  onGenerateKG,
  onGenerateEmail,
  formData,
  onFormUpdate,
  emailData,
  onEmailUpdate,
  onWidthChange,
}: StepPanelProps) {
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        // Constrain between 280px and 600px
        const constrainedWidth = Math.min(Math.max(newWidth, 280), 600);
        onWidthChange(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  return (
    <div ref={panelRef} className="h-full flex bg-white border-r border-gray-200 overflow-hidden relative">
      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden mr-1">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Workflow</h2>
        <p className="text-sm text-gray-500 mt-1">Step {currentStep} of 3</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Step 1: Form */}
          <div className={cn(
            "rounded-lg border-2 transition-all",
            currentStep === 1 ? "border-yellow-500 bg-yellow-50" : currentStep > 1 ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-gray-50"
          )}>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                {currentStep > 1 ? (
                  <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0" />
                ) : currentStep === 1 ? (
                  <Circle className="h-5 w-5 text-yellow-600 fill-yellow-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
                <div>
                  <span className="text-xs font-medium text-gray-500">Step 1</span>
                  <h3 className={cn(
                    "text-sm font-semibold",
                    currentStep === 1 ? "text-yellow-900" : currentStep > 1 ? "text-purple-900" : "text-gray-600"
                  )}>
                    Input Form
                  </h3>
                </div>
              </div>

              {formData && onFormUpdate && (
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Product Description
                    </label>
                    <textarea
                      value={formData.productDescription}
                      onChange={(e) => onFormUpdate({ productDescription: e.target.value })}
                      placeholder="Describe your product..."
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={2}
                      disabled={formData.isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Customer Description
                    </label>
                    <textarea
                      value={formData.customerDescription}
                      onChange={(e) => onFormUpdate({ customerDescription: e.target.value })}
                      placeholder="Describe your target customer..."
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={2}
                      disabled={formData.isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Children Count
                      </label>
                      <input
                        type="number"
                        value={formData.childrenCount}
                        onChange={(e) => onFormUpdate({ childrenCount: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        disabled={formData.isLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Iterations
                      </label>
                      <input
                        type="number"
                        value={formData.generationCount}
                        onChange={(e) => onFormUpdate({ generationCount: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        disabled={formData.isLoading}
                      />
                    </div>
                  </div>

                  {/* Generate KG Button - Inside Step 1 */}
                  {isGeneratingKG ? (
                    <div className="mt-4">
                      <DreamerSpinner message="Dreaming your knowledge graph..." />
                    </div>
                  ) : (
                    <button
                      onClick={onGenerateKG}
                      disabled={!canGenerateKG}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors mt-4",
                        canGenerateKG
                          ? currentStep === 1
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : "bg-purple-500 hover:bg-purple-600 text-white"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Generate KG
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Review KG */}
          <div className={cn(
            "rounded-lg border-2 p-3 transition-all",
            currentStep === 2 ? "border-yellow-500 bg-yellow-50" : currentStep > 2 ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-gray-50"
          )}>
            <div className="flex items-center gap-2 mb-3">
              {currentStep > 2 ? (
                <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0" />
              ) : currentStep === 2 ? (
                <Circle className="h-5 w-5 text-yellow-600 fill-yellow-600 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
              <div>
                <span className="text-xs font-medium text-gray-500">Step 2</span>
                <h3 className={cn(
                  "text-sm font-semibold",
                  currentStep === 2 ? "text-yellow-900" : currentStep > 2 ? "text-purple-900" : "text-gray-600"
                )}>
                  Review KG
                </h3>
                <p className="text-xs text-gray-500">Edit nodes on canvas or via chat</p>
              </div>
            </div>

            {/* Generate Email Button - Inside Step 2 */}
            {isGeneratingEmail ? (
              <div className="mb-3">
                <DreamerSpinner message="Dreaming up your email..." />
              </div>
            ) : (
              <button
                onClick={onGenerateEmail}
                disabled={!canGenerateEmail}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors",
                  canGenerateEmail
                    ? currentStep === 2
                      ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                      : "bg-purple-500 hover:bg-purple-600 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                )}
              >
                <Mail className="h-4 w-4" />
                Generate Email
              </button>
            )}
          </div>

          {/* Step 3: Email */}
          <div className={cn(
            "rounded-lg border-2 transition-all",
            currentStep === 3 ? "border-yellow-500 bg-yellow-50" : "border-gray-200 bg-gray-50"
          )}>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                {currentStep === 3 ? (
                  <Circle className="h-5 w-5 text-yellow-600 fill-yellow-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
                <div>
                  <span className="text-xs font-medium text-gray-500">Step 3</span>
                  <h3 className={cn(
                    "text-sm font-semibold",
                    currentStep === 3 ? "text-yellow-900" : "text-gray-600"
                  )}>
                    Email Summary
                  </h3>
                </div>
              </div>

              {isGeneratingEmail || (emailData && emailData.isLoading) ? (
                <div className="mt-3">
                  <DreamerSpinner message="Dreaming up your email..." />
                </div>
              ) : emailData && onEmailUpdate && emailData.emailText ? (
                <div className="mt-3">
                  <TextareaAutosize
                    value={emailData.emailText}
                    onChange={(e) => onEmailUpdate({ emailText: e.target.value })}
                    placeholder="Email will appear here..."
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none leading-relaxed"
                    minRows={8}
                    disabled={emailData.isLoading}
                  />
                </div>
              ) : (
                <div className="mt-3 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                  <div className="text-center">
                    <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">
                      Email will appear here after generation
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500 transition-colors group",
          isResizing && "bg-purple-500"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <GripVertical className="h-6 w-6 text-purple-500" />
        </div>
      </div>
    </div>
  );
}
