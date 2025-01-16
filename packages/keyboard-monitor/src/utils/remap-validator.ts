import { RemapRule, RemapValidationError } from '../types/keyboard';
import { getValidKeyNames } from './key-names';

const MAX_CHAIN_LENGTH = 5; // Maximum length of remap chain to prevent excessive recursion

/**
 * Validates a set of remap rules for circular dependencies and invalid keys
 */
export function validateRemapRules(
  remaps: Record<string, string[]>
): RemapValidationError[] {
  const errors: RemapValidationError[] = [];
  const validKeys = new Set(getValidKeyNames());

  // Convert to RemapRule format for easier processing
  const rules = Object.entries(remaps).map(([from, to]) => ({ from, to }));

  // Check for basic validation first
  for (const rule of rules) {
    // Check for valid keys
    if (!validKeys.has(rule.from)) {
      errors.push({
        type: 'invalid_key',
        message: `Invalid source key: ${rule.from}`,
        rule,
      });
    }

    for (const toKey of rule.to) {
      if (!validKeys.has(toKey)) {
        errors.push({
          type: 'invalid_key',
          message: `Invalid target key: ${toKey}`,
          rule,
        });
      }
    }

    // Check for self-references
    if (rule.to.includes(rule.from)) {
      errors.push({
        type: 'self_reference',
        message: `Key ${rule.from} cannot remap to itself`,
        rule,
      });
    }
  }

  // Check for circular dependencies
  for (const rule of rules) {
    const visited = new Set<string>();
    const chain: string[] = [];

    function checkCircular(currentKey: string, depth: number = 0): boolean {
      // Check chain length
      if (depth > MAX_CHAIN_LENGTH) {
        errors.push({
          type: 'chain_length',
          message: `Remap chain exceeds maximum length of ${MAX_CHAIN_LENGTH}`,
          rule,
        });
        return true;
      }

      // Check for circular reference
      if (visited.has(currentKey)) {
        const circularChain = [...chain, currentKey].join(' -> ');
        errors.push({
          type: 'circular',
          message: `Circular remap detected: ${circularChain}`,
          rule,
        });
        return true;
      }

      visited.add(currentKey);
      chain.push(currentKey);

      // Check all target keys
      const targetKeys = remaps[currentKey] || [];
      for (const targetKey of targetKeys) {
        if (checkCircular(targetKey, depth + 1)) {
          return true;
        }
      }

      chain.pop();
      visited.delete(currentKey);
      return false;
    }

    checkCircular(rule.from);
  }

  return errors;
}

/**
 * Gets all keys that would be triggered by a source key, including chain remaps
 */
export function getRemapChain(
  sourceKey: string,
  remaps: Record<string, string[]>,
  maxDepth: number = MAX_CHAIN_LENGTH
): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();

  function traverse(key: string, depth: number = 0) {
    if (depth > maxDepth || visited.has(key)) return;
    visited.add(key);

    const targetKeys = remaps[key] || [];
    for (const targetKey of targetKeys) {
      result.add(targetKey);
      traverse(targetKey, depth + 1);
    }
  }

  traverse(sourceKey);
  return result;
}

/**
 * Checks if a remap configuration is valid
 */
export function isValidRemapConfig(remaps: Record<string, string[]>): boolean {
  return validateRemapRules(remaps).length === 0;
}
