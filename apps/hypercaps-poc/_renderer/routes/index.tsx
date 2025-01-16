import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h1 className="mb-4 text-4xl font-bold">Welcome to HyperCaps</h1>
      <p className="text-lg text-muted-foreground">
        Your keyboard customization tool
      </p>
    </div>
  );
}
