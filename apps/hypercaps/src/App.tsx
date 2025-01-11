import { useState, useEffect } from "react";
import { MappingList } from "./components/MappingList";

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
        getMappings: () => Promise<any>;
        addMapping: (mapping: any) => Promise<any>;
        updateMapping: (id: string, updates: any) => Promise<any>;
        deleteMapping: (id: string) => Promise<any>;
      };
    };
  }
}

interface KeyEvent {
  keycode: number;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  capsLock: boolean;
  timestamp: number;
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [lastEvent, setLastEvent] = useState<KeyEvent | null>(null);

  useEffect(() => {
    const handleKeyEvent = (event: KeyEvent) => {
      setLastEvent(event);
    };

    window.electron.ipcRenderer.on("keyboard-event", handleKeyEvent);

    return () => {
      window.electron.ipcRenderer.removeListener(
        "keyboard-event",
        handleKeyEvent
      );
    };
  }, []);

  const toggleListening = () => {
    const newState = !isListening;
    setIsListening(newState);
    window.electron.ipcRenderer.send(
      newState ? "start-listening" : "stop-listening"
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">HyperCaps</h1>
        <p className="text-gray-400">Advanced keyboard remapping for Windows</p>
      </header>

      <main className="space-y-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Keyboard Listener</h2>
            <button
              onClick={toggleListening}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isListening
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isListening ? "Stop Listening" : "Start Listening"}
            </button>
          </div>
          <div className="bg-gray-900 rounded-md p-4 font-mono">
            {isListening ? (
              lastEvent ? (
                <div className="space-y-1">
                  <p className="text-green-400">Current key states:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`p-2 rounded ${
                        lastEvent.ctrlKey ? "bg-green-600" : "bg-gray-700"
                      }`}
                    >
                      Ctrl: {lastEvent.ctrlKey ? "Pressed" : "Released"}
                    </div>
                    <div
                      className={`p-2 rounded ${
                        lastEvent.altKey ? "bg-green-600" : "bg-gray-700"
                      }`}
                    >
                      Alt: {lastEvent.altKey ? "Pressed" : "Released"}
                    </div>
                    <div
                      className={`p-2 rounded ${
                        lastEvent.shiftKey ? "bg-green-600" : "bg-gray-700"
                      }`}
                    >
                      Shift: {lastEvent.shiftKey ? "Pressed" : "Released"}
                    </div>
                    <div
                      className={`p-2 rounded ${
                        lastEvent.metaKey ? "bg-green-600" : "bg-gray-700"
                      }`}
                    >
                      Win: {lastEvent.metaKey ? "Pressed" : "Released"}
                    </div>
                    <div
                      className={`p-2 rounded ${
                        lastEvent.capsLock ? "bg-yellow-600" : "bg-gray-700"
                      }`}
                    >
                      CapsLock: {lastEvent.capsLock ? "ON" : "OFF"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-green-400">
                  Listening for keyboard events...
                </p>
              )
            ) : (
              <p className="text-gray-500">Click Start Listening to begin</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <MappingList />
        </div>
      </main>
    </div>
  );
}

export default App;
