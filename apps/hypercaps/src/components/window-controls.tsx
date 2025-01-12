import React from "react";
import { Button } from "./ui/button";
import { X, Minus } from "lucide-react";

export function WindowControls() {
  const handleMinimize = () => window.electron?.minimize();
  const handleClose = () => window.electron?.close();

  return (
    <div className="flex gap-2 window-controls">
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6"
        onClick={handleMinimize}
        aria-label="Minimize"
      >
        <Minus className="size-2" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6 hover:bg-destructive"
        onClick={handleClose}
        aria-label="Close"
      >
        <X className="size-2" />
      </Button>
    </div>
  );
}
