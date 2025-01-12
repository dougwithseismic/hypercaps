import { useKeyboard } from "../contexts/keyboard-context";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function KeyStateVisualizer() {
  const { state } = useKeyboard();
  const { modifiers, currentKeys } = state;

  return (
    <Card className="bg-background/50 backdrop-blur-md border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Current Key States</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={modifiers.ctrlKey ? "default" : "secondary"}>
            Ctrl
          </Badge>
          <Badge variant={modifiers.altKey ? "default" : "secondary"}>
            Alt
          </Badge>
          <Badge variant={modifiers.shiftKey ? "default" : "secondary"}>
            Shift
          </Badge>
          <Badge variant={modifiers.metaKey ? "default" : "secondary"}>
            Win
          </Badge>
          <Badge variant={modifiers.capsLock ? "default" : "secondary"}>
            Caps
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentKeys.map((key) => (
            <Badge
              key={key}
              variant="outline"
              className="animate-in fade-in zoom-in"
            >
              {key}
            </Badge>
          ))}
          {currentKeys.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No keys pressed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
