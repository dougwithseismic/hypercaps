import type { Shortcut, TriggerStep } from './types'
import type {
  PatternNode,
  PatternNodeType,
  PatternNodeConditions,
  ShortcutPattern
} from './types/patterns'

type HoldStep = TriggerStep & { type: 'hold' }
type ComboStep = TriggerStep & { type: 'combo' }

export class PatternFactory {
  private holdPatterns = new Map<string, PatternNode>()
  private comboPatterns = new Map<string, PatternNode>()

  createFromConfig(shortcuts: Shortcut[]): {
    holdPatterns: Map<string, PatternNode>
    comboPatterns: Map<string, PatternNode>
  } {
    // Reset patterns
    this.holdPatterns.clear()
    this.comboPatterns.clear()

    // Process each shortcut
    for (const shortcut of shortcuts) {
      const firstStep = shortcut.trigger.steps[0]
      if (!firstStep) {
        console.warn(`[PatternFactory] Shortcut ${shortcut.id} has no steps, skipping`)
        continue
      }

      const baseKey = firstStep.keys[0]
      if (!baseKey) {
        console.warn(`[PatternFactory] Shortcut ${shortcut.id} first step has no keys, skipping`)
        continue
      }

      // Create pattern object
      const pattern: ShortcutPattern = {
        id: shortcut.id,
        remainingSteps: shortcut.trigger.steps.slice(1),
        action: shortcut.action,
        confidence: 0,
        priority: this.calculatePriority(shortcut)
      }

      // Add to appropriate tree based on first step type
      switch (firstStep.type) {
        case 'hold':
          this.addToHoldTree(baseKey, firstStep as HoldStep, pattern)
          break
        case 'combo':
          this.addToComboTree(baseKey, firstStep as ComboStep, pattern)
          break
        default:
          console.warn(
            `[PatternFactory] Shortcut ${shortcut.id} has unsupported first step type: ${firstStep.type}`
          )
      }
    }

    return {
      holdPatterns: this.holdPatterns,
      comboPatterns: this.comboPatterns
    }
  }

  private createPatternNode(
    type: PatternNodeType,
    keys: string[],
    conditions: PatternNodeConditions
  ): PatternNode {
    return {
      type,
      keys,
      patterns: [],
      children: new Map(),
      conditions
    }
  }

  private addToHoldTree(baseKey: string, step: HoldStep, pattern: ShortcutPattern): void {
    let node = this.holdPatterns.get(baseKey)

    // Create node if it doesn't exist
    if (!node) {
      node = this.createPatternNode('hold', step.keys, {
        window: step.conditions.window,
        holdTime: step.conditions.holdTime ?? 0,
        strict: step.conditions.strict
      })
      this.holdPatterns.set(baseKey, node)
    }

    // Add pattern to node
    node.patterns.push(pattern)

    // Sort patterns by priority
    node.patterns.sort((a, b) => b.priority - a.priority)

    // Build child nodes for remaining steps
    if (pattern.remainingSteps.length > 0) {
      this.buildChildNodes(node, pattern.remainingSteps, pattern)
    }
  }

  private addToComboTree(baseKey: string, step: ComboStep, pattern: ShortcutPattern): void {
    let node = this.comboPatterns.get(baseKey)

    // Create node if it doesn't exist
    if (!node) {
      node = this.createPatternNode('combo', step.keys, {
        window: step.conditions.window,
        strict: step.conditions.strict
      })
      this.comboPatterns.set(baseKey, node)
    }

    // Add pattern to node
    node.patterns.push(pattern)

    // Sort patterns by priority
    node.patterns.sort((a, b) => b.priority - a.priority)

    // Build child nodes for remaining steps
    if (pattern.remainingSteps.length > 0) {
      this.buildChildNodes(node, pattern.remainingSteps, pattern)
    }
  }

  private buildChildNodes(
    parentNode: PatternNode,
    remainingSteps: TriggerStep[],
    pattern: ShortcutPattern
  ): void {
    if (remainingSteps.length === 0) return

    const nextStep = remainingSteps[0]
    if (!this.isValidStepType(nextStep.type)) {
      console.warn(
        `[PatternFactory] Invalid step type: ${nextStep.type}, skipping child node creation`
      )
      return
    }

    const key = nextStep.keys[0]
    if (!key) {
      console.warn('[PatternFactory] Step has no keys, skipping child node creation')
      return
    }

    // Create or get child node
    let childNode = parentNode.children.get(key)
    if (!childNode) {
      childNode = this.createPatternNode(nextStep.type as PatternNodeType, nextStep.keys, {
        window: nextStep.conditions.window,
        holdTime: nextStep.type === 'hold' ? (nextStep.conditions.holdTime ?? 0) : undefined,
        strict: nextStep.conditions.strict
      })
      parentNode.children.set(key, childNode)
    }

    // Add pattern with updated remaining steps
    const updatedPattern = {
      ...pattern,
      remainingSteps: remainingSteps.slice(1)
    }
    childNode.patterns.push(updatedPattern)

    // Sort patterns by priority
    childNode.patterns.sort((a, b) => b.priority - a.priority)

    // Continue building tree
    this.buildChildNodes(childNode, remainingSteps.slice(1), pattern)
  }

  private isValidStepType(type: string): type is PatternNodeType {
    return type === 'hold' || type === 'combo'
  }

  private calculatePriority(shortcut: Shortcut): number {
    return (
      shortcut.trigger.steps.length * 100 + // More steps = higher priority
      shortcut.trigger.steps.reduce((sum, step) => sum + step.keys.length, 0) * 10 + // More keys = higher priority
      (shortcut.trigger.steps[0].type === 'hold' ? 50 : 0) // Hold patterns get bonus
    )
  }
}
