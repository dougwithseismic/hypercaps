# Shortcut Manager Pattern Tree Solution

## Overview

A new approach to handling keyboard shortcuts using a pattern tree factory system. This solution maintains the existing config structure while providing a more efficient and organized runtime pattern matching system.

## Core Components

### 1. Pattern Trees

```typescript
interface PatternNode {
  keys: string[]
  type: 'hold' | 'combo'
  patterns: ShortcutPattern[]
  children: Map<string, PatternNode>
  conditions?: {
    window: number
    holdTime?: number
    strict: boolean
  }
}

interface ShortcutPattern {
  id: string
  remainingSteps: TriggerStep[]
  action: ShortcutAction
  confidence: number
  priority: number
}
```

### 2. Pattern Factory

```typescript
class PatternFactory {
  private holdPatterns = new Map<string, PatternNode>()
  private comboPatterns = new Map<string, PatternNode>()

  createFromConfig(shortcuts: Shortcut[]): void {
    for (const shortcut of shortcuts) {
      const firstStep = shortcut.trigger.steps[0]
      const baseKey = firstStep.keys[0]
      
      if (firstStep.type === 'hold') {
        this.addToHoldTree(baseKey, shortcut)
      } else {
        this.addToComboTree(baseKey, shortcut)
      }
    }
  }
}
```

## Pattern Matching Process

1. **Frame Processing**

```typescript
function processFrame(frame: KeyboardFrame) {
  // Check hold patterns
  for (const [key, pattern] of holdPatterns) {
    if (frame.heldKeys.has(key)) {
      checkHoldPattern(pattern, frame)
    }
  }

  // Check combo patterns
  for (const [key, pattern] of comboPatterns) {
    if (frame.justPressed.has(key)) {
      checkComboPattern(pattern, frame)
    }
  }
}
```

2. **Pattern State Management**

```typescript
interface PatternState {
  patternId: string
  currentNode: PatternNode
  startTime: number
  confidence: number
  matchedKeys: Set<string>
}
```

3. **Confidence Scoring**

- Base confidence from number of keys matched
- Bonus for strict matches
- Penalty for timing variations
- Priority boost for longer patterns

## Key Features

### 1. Progressive Pattern Matching

- Patterns can share initial steps
- Longer patterns take priority
- Grace period for potential longer matches

### 2. Hold Pattern Handling

```
HoldPatterns
└── LShift
    ├── Duration: 1000ms
    ├── Action: notepad.exe
    └── Children
        └── A
            └── Action: calc.exe
```

### 3. Combo Pattern Handling

```
ComboPatterns
└── HG
    ├── Action: explorer.exe
    └── Children
        └── HG
            └── HG
                └── Action: final.exe
```

## Implementation Phases

### Phase 1: Core Structure

1. Create pattern tree interfaces
2. Implement pattern factory
3. Basic frame processing

### Phase 2: Pattern Matching

1. Hold pattern matching
2. Combo pattern matching
3. Progressive pattern support

### Phase 3: Advanced Features

1. Confidence scoring
2. Priority system
3. Grace period handling

### Phase 4: Cleanup & Optimization

1. Pattern cleanup
2. Memory management
3. Performance optimization

## Benefits

1. **Efficient Pattern Matching**
   - Quick filtering by first key
   - Early pattern rejection
   - Optimized tree traversal

2. **Clear Pattern Organization**
   - Patterns grouped by type and base key
   - Clear parent-child relationships
   - Easy to visualize and debug

3. **Better Conflict Resolution**
   - Natural priority system
   - Clear handling of overlapping patterns
   - Grace period for longer matches

4. **Maintainable Structure**
   - Separation of concerns
   - Clear pattern relationships
   - Easy to extend

## Technical Considerations

### Memory Management

- Cleanup of completed patterns
- Efficient tree structure
- Garbage collection friendly

### Performance

- Quick pattern lookup
- Efficient tree traversal
- Minimal frame processing overhead

### Error Handling

- Invalid pattern detection
- Graceful error recovery
- Clear error reporting

## Migration Strategy

1. **Phase 1: Parallel Implementation**
   - Keep existing system
   - Build new system alongside
   - Compare results

2. **Phase 2: Testing**
   - Unit tests for new system
   - Integration tests
   - Performance benchmarks

3. **Phase 3: Switchover**
   - Gradual feature transition
   - Validation of results
   - Cleanup old system
