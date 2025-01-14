import { Badge } from '@/components/ui/badge';
import { KeyBuffer } from '@/components/ui/key-buffer';
import { useHypercapsStore } from '@/lib/ipc/client';
import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const { keyBuffer } = useHypercapsStore();

  const renderKey = (key: string) => {
    if (keyBuffer.held.includes(key)) {
      const duration = keyBuffer.holdDurations[key];
      return (
        <Badge key={key} variant="secondary">
          {key} ({Math.floor(duration)}ms)
        </Badge>
      );
    }
    return <Badge key={key}>{key}</Badge>;
  };

  const currentKeys = new Set([...keyBuffer.justPressed, ...keyBuffer.held]);

  return (
    <div className="container mx-auto">
      <div className="row h-8 flex gap-1">
        {Array.from(currentKeys).map(renderKey)}
      </div>
      <KeyBuffer />
    </div>
  );
}
