"use client";

import { cn } from "@/lib/utils";

interface DreamerSpinnerProps {
  className?: string;
  message?: string;
}

/**
 * Cute sleeping/dreaming animation loader
 * Echoes the "CoDreamer" theme with sleeping emoji and gentle animation
 */
export function DreamerSpinner({ className, message = "Dreaming up your email..." }: DreamerSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-8", className)}>
      {/* Animated sleeping face */}
      <div className="relative">
        <div className="text-6xl animate-bounce">💤</div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-4xl animate-pulse">
          😴
        </div>
      </div>

      {/* Message text */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-lg font-medium text-foreground animate-pulse">
          {message}
        </p>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>

      {/* Cloud decoration */}
      <div className="flex gap-2 opacity-40">
        <span className="text-2xl">☁️</span>
        <span className="text-xl">☁️</span>
        <span className="text-2xl">☁️</span>
      </div>
    </div>
  );
}
