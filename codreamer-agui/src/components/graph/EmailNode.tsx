"use client";

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import TextareaAutosize from 'react-textarea-autosize';
import type { EmailNodeData } from '@/lib/canvas/types';

export interface EmailNodeProps {
  data: EmailNodeData;
  onUpdate: (data: Partial<EmailNodeData>) => void;
}

function EmailNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as EmailNodeProps;
  const { data: emailData, onUpdate } = nodeData;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-gray-300 p-5 shadow-lg bg-white w-[450px] min-h-[300px]",
        "relative"
      )}
    >
      {/* Loading overlay */}
      {emailData.isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Summary</h3>
          <p className="text-sm text-gray-500">Step 3: Generate Email</p>
        </div>
      </div>

      {/* Email Content */}
      <div>
        {emailData.emailText ? (
          <TextareaAutosize
            id={`email-text-${id}`}
            name={`email-text-${id}`}
            value={emailData.emailText}
            onChange={(e) => onUpdate({ emailText: e.target.value })}
            placeholder="Email will appear here after generation..."
            className={cn(
              "w-full resize-none rounded-lg border border-gray-300 p-3 text-sm leading-6",
              "outline-none placeholder:text-gray-400",
              "hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
              "whitespace-pre-wrap"
            )}
            minRows={12}
          />
        ) : (
          <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Click &quot;Generate Email&quot; to create<br />
                email summary from your knowledge graph
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EmailNode = memo(EmailNodeComponent);
export default EmailNode;
