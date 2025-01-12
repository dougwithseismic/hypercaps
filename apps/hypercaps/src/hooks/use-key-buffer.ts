import { useState, useRef, useCallback, useEffect } from "react";
import { WindowsFormsKeyName } from "../components/key-state-visualizer";

export interface UseKeyBufferOptions {
  completionDelay?: number;
  maxKeys?: number;
  onComplete?: (keys: string[]) => void;
  clearOnComplete?: boolean;
}

export interface UseKeyBufferReturn {
  buffer: WindowsFormsKeyName[];
  isComplete: boolean;
  isBuffering: boolean;
  addKeys: (keys: WindowsFormsKeyName[]) => void;
  resetBuffer: () => void;
}

export function useKeyBuffer({
  completionDelay = 500,
  maxKeys,
  onComplete,
  clearOnComplete = false,
}: UseKeyBufferOptions = {}): UseKeyBufferReturn {
  const [buffer, setBuffer] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const timeoutRef = useRef<number>();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const resetBuffer = useCallback(() => {
    setBuffer([]);
    setIsComplete(false);
    setIsBuffering(false);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const addKeys = useCallback(
    (newKeys: string[]) => {
      // If no keys pressed, potentially complete the buffer
      if (newKeys.length === 0) {
        if (buffer.length > 0 && !isComplete) {
          setIsComplete(true);
          setIsBuffering(false);
          onComplete?.(buffer);
          if (clearOnComplete) {
            resetBuffer();
          }
        }
        return;
      }

      // If buffer is complete and new keys pressed, reset and start fresh
      if (isComplete) {
        resetBuffer();
      }

      setIsBuffering(true);
      setIsComplete(false);

      // Update buffer with new keys, respecting maxKeys if set
      setBuffer((prev) => {
        const uniqueKeys = Array.from(new Set([...prev, ...newKeys]));
        return maxKeys ? uniqueKeys.slice(0, maxKeys) : uniqueKeys;
      });

      // Clear existing timeout and set new one
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      // Set timeout to mark buffer as complete after delay
      if (completionDelay > 0) {
        timeoutRef.current = window.setTimeout(() => {
          setIsComplete(true);
          setIsBuffering(false);
          onComplete?.(buffer);
          if (clearOnComplete) {
            resetBuffer();
          }
        }, completionDelay);
      }
    },
    [
      buffer,
      isComplete,
      maxKeys,
      completionDelay,
      onComplete,
      resetBuffer,
      clearOnComplete,
    ]
  );

  return {
    buffer,
    isComplete,
    isBuffering,
    addKeys,
    resetBuffer,
  };
}
