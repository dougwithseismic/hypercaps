import React from "react";
import { KeyboardProvider, useKeyboard } from "./contexts/keyboard-context";
import { MappingList } from "./components/mapping-list";
import { Settings } from "./components/settings";

// Declare the window API type
declare global {
  interface Window {
    electron: {
      minimize: () => void;
      close: () => void;
    };
  }
}

function WindowControls() {
  const handleMinimize = () => window.electron?.minimize();
  const handleClose = () => window.electron?.close();

  return (
    <div className="window-controls">
      <button
        className="window-control-button window-control-minimize"
        onClick={handleMinimize}
        aria-label="Minimize"
      />
      <button
        className="window-control-button window-control-close"
        onClick={handleClose}
        aria-label="Close"
      />
    </div>
  );
}

function KeyboardStatus() {
  const { state, toggleService } = useKeyboard();

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Keyboard Status</h2>
        <button
          onClick={toggleService}
          className={`px-4 py-2 rounded-md ${
            state.isEnabled
              ? "bg-green-500 hover:bg-green-600"
              : "bg-red-500 hover:bg-red-600"
          } text-white transition-colors`}
        >
          {state.isEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        {Object.entries(state.modifiers).map(([key, value]) => (
          <div
            key={key}
            className={`p-2 rounded ${
              value ? "bg-blue-500" : "bg-gray-700"
            } text-white text-center`}
          >
            {key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}
          </div>
        ))}
      </div>

      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Pressed Keys</h3>
        <div className="flex flex-wrap gap-2">
          {state.currentKeys.map((key) => (
            <span
              key={key}
              className="px-3 py-1 bg-blue-500 text-white rounded-md"
            >
              {key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <KeyboardProvider>
      <div className="title-bar">
        <span className="text-white/50 text-sm">HyperCaps</span>
        <WindowControls />
      </div>
      <div className="main-content">
        <div className="space-y-6">
          <KeyboardStatus />
          <MappingList />
          <Settings />
        </div>
      </div>
    </KeyboardProvider>
  );
}

export default App;
