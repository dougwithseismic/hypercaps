import { RemapValidationError } from '../types/keyboard';
/**
 * Validates a set of remap rules for circular dependencies and invalid keys
 */
export declare function validateRemapRules(remaps: Record<string, string[]>): RemapValidationError[];
/**
 * Gets all keys that would be triggered by a source key, including chain remaps
 */
export declare function getRemapChain(sourceKey: string, remaps: Record<string, string[]>, maxDepth?: number): Set<string>;
/**
 * Checks if a remap configuration is valid
 */
export declare function isValidRemapConfig(remaps: Record<string, string[]>): boolean;
