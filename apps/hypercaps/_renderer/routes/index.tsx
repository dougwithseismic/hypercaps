import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/' as const)({
  component: () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">Welcome to HyperCaps</h1>
      <p className="text-lg text-muted-foreground">
        Your keyboard customization tool
      </p>
    </div>
  ),
});
