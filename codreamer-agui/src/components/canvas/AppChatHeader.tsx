"use client";

import { X } from "lucide-react";
import { useChatContext, HeaderProps } from "@copilotkit/react-ui";

export function AppChatHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="p-4 border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent Chat</h2>
          <p className="text-sm text-gray-500 mt-1">AI Assistant</p>
        </div>
        {typeof onClose === "function" && (
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            onClick={() => onClose?.()}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function PopupHeader({}: HeaderProps) {
  const { setOpen } = useChatContext();
  return <AppChatHeader onClose={() => setOpen(false)} />;
}

export default AppChatHeader;


