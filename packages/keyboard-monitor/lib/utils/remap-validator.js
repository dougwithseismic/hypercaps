"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRemapRules = validateRemapRules;
exports.getRemapChain = getRemapChain;
exports.isValidRemapConfig = isValidRemapConfig;
const key_names_1 = require("./key-names");
const MAX_CHAIN_LENGTH = 5; // Maximum length of remap chain to prevent excessive recursion
/**
 * Validates a set of remap rules for circular dependencies and invalid keys
 */
function validateRemapRules(remaps) {
    const errors = [];
    const validKeys = new Set((0, key_names_1.getValidKeyNames)());
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
        const visited = new Set();
        const chain = [];
        function checkCircular(currentKey, depth = 0) {
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
function getRemapChain(sourceKey, remaps, maxDepth = MAX_CHAIN_LENGTH) {
    const result = new Set();
    const visited = new Set();
    function traverse(key, depth = 0) {
        if (depth > maxDepth || visited.has(key))
            return;
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
function isValidRemapConfig(remaps) {
    return validateRemapRules(remaps).length === 0;
}
