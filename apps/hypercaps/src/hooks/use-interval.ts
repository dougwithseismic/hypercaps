import * as React from 'react';

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef<() => void>();

  // Remember the latest callback
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  React.useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
