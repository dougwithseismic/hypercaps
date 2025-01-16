import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/remapper' as const)({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Key Remapper</h1>
        <p className="text-muted-foreground">
          Customize your keyboard key mappings
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">CapsLock Behavior</h2>
          {/* Add CapsLock behavior selector here */}
          <p className="text-muted-foreground">
            CapsLock configuration coming soon...
          </p>
        </div>

        <div className="p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">Key Mappings</h2>
          {/* Add key mapping configuration here */}
          <p className="text-muted-foreground">
            Key mapping configuration coming soon...
          </p>
        </div>
      </div>
    </div>
  ),
});
