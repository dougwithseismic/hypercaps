import { createFileRoute } from "@tanstack/react-router";
import { MappingList } from "../components/mapping-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { KeyStateVisualizer } from "@/components/key-state-visualizer";
import { HyperKeyConfig } from "@/components/hyperkey-config";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Key Mappings</h1>
        <p className="text-muted-foreground">
          Configure your keyboard mappings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <HyperKeyConfig />
          <MappingList />
          <KeyStateVisualizer />
        </CardContent>
      </Card>
    </div>
  );
}
