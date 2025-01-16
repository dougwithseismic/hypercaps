import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="container mx-auto">
      <div className="flex h-8 gap-1 row">TBC</div>
    </div>
  );
}
