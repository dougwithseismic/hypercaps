import { Button } from "./ui/button";
import { useKeyboardStore } from "../store/keyboard-store";

export function TitleBar() {
  const { isEnabled } = useKeyboardStore();

  const handleMinimize = () => {
    window.electron.minimize();
  };

  const handleClose = () => {
    window.electron.close();
  };

  return (
    <div className="flex items-center justify-between p-2 bg-background/50 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">HyperCaps</span>
        <span className="text-xs text-muted-foreground">
          {isEnabled ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleMinimize}
        >
          ─
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClose}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
