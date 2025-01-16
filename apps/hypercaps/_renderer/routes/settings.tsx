import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings' as const)({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your keyboard settings and preferences
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">General Settings</h2>
          {/* Add settings form here */}
          <p className="text-muted-foreground">Settings coming soon...</p>
        </div>
      </div>
    </div>
  ),
});
