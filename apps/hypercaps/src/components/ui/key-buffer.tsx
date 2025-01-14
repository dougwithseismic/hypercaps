import * as React from 'react';
import { Badge } from './badge';
import { useHypercapsStore } from '@/lib/ipc/client';
import { useInterval } from '../../hooks/use-interval';

interface KeyState {
  key: string;
  state: 'down' | 'up' | 'held';
  duration: number;
  timestamp: number;
}

const KEY_DISPLAY_DURATION = 2000; // Show keys for 2 seconds after release

export function KeyBuffer() {
  const { pressedKeys } = useHypercapsStore();
  const [keyStates, setKeyStates] = React.useState<KeyState[]>([]);

  // Update key states based on pressedKeys
  React.useEffect(() => {
    setKeyStates((prev: KeyState[]) => {
      const currentKeys = new Set(pressedKeys);
      const newStates: KeyState[] = prev
        .filter(
          (ks) =>
            currentKeys.has(ks.key) ||
            Date.now() - ks.timestamp < KEY_DISPLAY_DURATION
        )
        .map((ks) => ({
          ...ks,
          state: currentKeys.has(ks.key) ? 'held' : 'up',
          duration: currentKeys.has(ks.key) ? ks.duration + 100 : ks.duration,
        }));

      // Add new keys
      pressedKeys.forEach((key) => {
        if (!newStates.some((ks) => ks.key === key)) {
          newStates.push({
            key,
            state: 'down',
            duration: 0,
            timestamp: Date.now(),
          });
        }
      });

      return newStates;
    });
  }, [pressedKeys]);

  // Update durations every 100ms
  useInterval(() => {
    setKeyStates((prev) =>
      prev.map((ks) => ({
        ...ks,
        duration: ks.state !== 'up' ? ks.duration + 100 : ks.duration,
      }))
    );
  }, 100);

  return (
    <div className="flex flex-wrap gap-1">
      {keyStates.map(({ key, state, duration }) => (
        <Badge
          key={key}
          variant={getVariant(state)}
          className="flex items-center gap-1"
        >
          <span>{key}</span>
          <span className="text-xs opacity-75">
            ({state === 'held' ? `${(duration / 1000).toFixed(1)}s` : state})
          </span>
        </Badge>
      ))}
    </div>
  );
}

function getVariant(state: KeyState['state']) {
  switch (state) {
    case 'down':
      return 'destructive';
    case 'up':
      return 'outline';
    case 'held':
      return 'secondary';
    default:
      return 'default';
  }
}
