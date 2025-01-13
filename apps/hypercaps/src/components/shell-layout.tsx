import React from "react";

interface ShellLayoutProps {
  children: React.ReactNode;
  title?: string;
  statusText?: string;
}

export function ShellLayout({
  children,
  title = "HyperCaps",
  statusText,
}: ShellLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>

      {/* Status Bar */}
      <div className="flex items-center px-4 py-1.5 bg-muted/50 backdrop-blur-sm border-t text-xs text-muted-foreground">
        <span>{statusText}</span>
      </div>
    </div>
  );
}
