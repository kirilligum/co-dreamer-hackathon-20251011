"use client";

import { useState, useRef, useEffect } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CustomerStatus = 'new' | 'sent' | 'opened' | 'in convo';

export interface Customer {
  id: string;
  name: string;
  email: string;
  companyName: string;
  status: CustomerStatus;
}

export interface CustomerListPanelProps {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string) => void;
  onUpdateCustomer: (customerId: string, updates: Partial<Customer>) => void;
  onAddCustomer: () => void;
  onWidthChange: (width: number) => void;
}

const statusColors: Record<CustomerStatus, string> = {
  'new': 'bg-blue-100 text-blue-800',
  'sent': 'bg-purple-100 text-purple-800',
  'opened': 'bg-yellow-100 text-yellow-800',
  'in convo': 'bg-green-100 text-green-800',
};

export default function CustomerListPanel({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onUpdateCustomer,
  onAddCustomer,
  onWidthChange,
}: CustomerListPanelProps) {
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
        // Constrain between 240px and 400px
        const constrainedWidth = Math.min(Math.max(newWidth, 240), 400);
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
            <button
              onClick={onAddCustomer}
              className="p-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
              title="Add new customer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">{customers.length} total</p>
        </div>

        {/* Scrollable Customer List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {customers.map((customer) => {
              const isSelected = selectedCustomerId === customer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() => !isSelected && onSelectCustomer(customer.id)}
                  className={cn(
                    "w-full p-3 rounded-lg mb-2 transition-all relative",
                    isSelected
                      ? "bg-purple-100 border-2 border-purple-500"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 cursor-pointer"
                  )}
                >
                  {/* Status chip - top right */}
                  <div className="absolute top-2 right-2">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      statusColors[customer.status]
                    )}>
                      {customer.status}
                    </span>
                  </div>

                  {/* Content - editable when selected */}
                  <div className="pr-20">
                    {isSelected ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={customer.name}
                            onChange={(e) => onUpdateCustomer(customer.id, { name: e.target.value })}
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={customer.email}
                            onChange={(e) => onUpdateCustomer(customer.id, { email: e.target.value })}
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                          <input
                            type="text"
                            value={customer.companyName}
                            onChange={(e) => onUpdateCustomer(customer.id, { companyName: e.target.value })}
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold truncate text-gray-900">
                          {customer.name}
                        </p>
                        <p className="text-xs text-gray-600 truncate mt-0.5">{customer.companyName}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{customer.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
