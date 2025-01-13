import { Button } from "./ui/button";

export function TitleBar() {
  const handleMinimize = () => {
    window.electron.minimize();
  };

  const handleClose = () => {
    window.electron.close();
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-background/50 backdrop-blur-md border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">HyperCaps</span>
        <span className="text-xs text-muted-foreground">v0.0.1</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={handleMinimize}
        >
          ─
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={handleClose}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
