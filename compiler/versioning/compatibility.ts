/**
 * CORE Version Compatibility Checker
 * Detects breaking changes between function and type versions
 */

import {
  FunctionNode,
  TypeDefNode,
  TypeExprNode,
  EffectDeclaration,
  SecurityAttributes,
  ParameterNode,
} from '../ast/types';
import { parseVersion, compareVersions, VersionCompareResult } from './semver';

export enum CompatibilityLevel {
  FullyCompatible = 'fully-compatible',
  BackwardCompatible = 'backward-compatible',
  ForwardCompatible = 'forward-compatible',
  Breaking = 'breaking',
}

export interface CompatibilityResult {
  level: CompatibilityLevel;
  breakingChanges: BreakingChange[];
  warnings: string[];
}

export interface BreakingChange {
  type: BreakingChangeType;
  description: string;
  severity: 'error' | 'warning';
}

export enum BreakingChangeType {
  InputTypeChanged = 'input-type-changed',
  OutputTypeChanged = 'output-type-changed',
  ParameterAdded = 'parameter-added',
  ParameterRemoved = 'parameter-removed',
  EffectAdded = 'effect-added',
  EffectRemoved = 'effect-removed',
  SecurityStricter = 'security-stricter',
  SecurityLoosened = 'security-loosened',
  PurityChanged = 'purity-changed',
}

/**
 * Check compatibility between two function versions
 */
export function checkFunctionCompatibility(
  oldFn: FunctionNode,
  newFn: FunctionNode
): CompatibilityResult {
  const breakingChanges: BreakingChange[] = [];
  const warnings: string[] = [];

  // Check input signature compatibility
  const inputChanges = checkParameterCompatibility(
    oldFn.signature.inputs,
    newFn.signature.inputs,
    'input'
  );
  breakingChanges.push(...inputChanges);

  // Check output signature compatibility
  const outputChanges = checkParameterCompatibility(
    oldFn.signature.outputs,
    newFn.signature.outputs,
    'output'
  );
  breakingChanges.push(...outputChanges);

  // Check effect compatibility
  const effectChanges = checkEffectCompatibility(oldFn.effects, newFn.effects);
  breakingChanges.push(...effectChanges);

  // Check security compatibility
  const securityChanges = checkSecurityCompatibility(oldFn.security, newFn.security);
  breakingChanges.push(...securityChanges);

  // Check purity changes
  if (oldFn.metadata.pure && !newFn.metadata.pure) {
    breakingChanges.push({
      type: BreakingChangeType.PurityChanged,
      description: 'Function is no longer pure (now has side effects)',
      severity: 'error',
    });
  }

  // Determine compatibility level
  const level = determineCompatibilityLevel(breakingChanges);

  // Add warnings for non-breaking but notable changes
  if (newFn.metadata.pure && !oldFn.metadata.pure) {
    warnings.push('Function became pure (side effects removed)');
  }

  return { level, breakingChanges, warnings };
}

/**
 * Check parameter list compatibility
 */
function checkParameterCompatibility(
  oldParams: ParameterNode[],
  newParams: ParameterNode[],
  paramType: 'input' | 'output'
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  // Check for removed parameters
  for (let i = 0; i < oldParams.length; i++) {
    if (i >= newParams.length) {
      changes.push({
        type: BreakingChangeType.ParameterRemoved,
        description: `${paramType} parameter '${oldParams[i].name}' was removed`,
        severity: 'error',
      });
    } else {
      // Check type compatibility
      const oldType = typeToString(oldParams[i].paramType);
      const newType = typeToString(newParams[i].paramType);

      if (oldType !== newType) {
        // For inputs: contravariant (new must accept old's type)
        // For outputs: covariant (old must accept new's type)
        changes.push({
          type: BreakingChangeType.InputTypeChanged,
          description: `${paramType} parameter '${oldParams[i].name}' type changed from ${oldType} to ${newType}`,
          severity: 'error',
        });
      }
    }
  }

  // Check for added required parameters
  for (let i = oldParams.length; i < newParams.length; i++) {
    if (!newParams[i].optional) {
      changes.push({
        type: BreakingChangeType.ParameterAdded,
        description: `Required ${paramType} parameter '${newParams[i].name}' was added`,
        severity: 'error',
      });
    }
  }

  return changes;
}

/**
 * Check effect compatibility
 */
function checkEffectCompatibility(
  oldEffects: EffectDeclaration[],
  newEffects: EffectDeclaration[]
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  // Create effect signatures
  const oldEffectSet = new Set(oldEffects.map(e => `${e.effectType}:${e.target}`));
  const newEffectSet = new Set(newEffects.map(e => `${e.effectType}:${e.target}`));

  // Check for removed effects (generally OK, but worth noting)
  for (const oldEffect of oldEffectSet) {
    if (!newEffectSet.has(oldEffect)) {
      changes.push({
        type: BreakingChangeType.EffectRemoved,
        description: `Effect '${oldEffect}' was removed`,
        severity: 'warning',
      });
    }
  }

  // Check for added effects (breaking: function now does more than before)
  for (const newEffect of newEffectSet) {
    if (!oldEffectSet.has(newEffect)) {
      changes.push({
        type: BreakingChangeType.EffectAdded,
        description: `New effect '${newEffect}' was added`,
        severity: 'error',
      });
    }
  }

  return changes;
}

/**
 * Check security compatibility
 */
function checkSecurityCompatibility(
  oldSecurity: SecurityAttributes,
  newSecurity: SecurityAttributes
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  // Check for stricter role requirements
  const newRolesSet = new Set(newSecurity.requiredRoles);
  const oldRolesSet = new Set(oldSecurity.requiredRoles);

  // If new version requires roles that old didn't, it's stricter (breaking)
  for (const newRole of newRolesSet) {
    if (!oldRolesSet.has(newRole)) {
      changes.push({
        type: BreakingChangeType.SecurityStricter,
        description: `New role requirement added: '${newRole}'`,
        severity: 'error',
      });
    }
  }

  // If old version required roles that new doesn't, it's looser (potentially concerning)
  for (const oldRole of oldRolesSet) {
    if (!newRolesSet.has(oldRole)) {
      changes.push({
        type: BreakingChangeType.SecurityLoosened,
        description: `Role requirement removed: '${oldRole}'`,
        severity: 'warning',
      });
    }
  }

  // Check for stricter capability requirements
  for (const newCap of newSecurity.requiredCapabilities) {
    if (!oldSecurity.requiredCapabilities.includes(newCap)) {
      changes.push({
        type: BreakingChangeType.SecurityStricter,
        description: `New capability requirement added: '${newCap}'`,
        severity: 'error',
      });
    }
  }

  // Check audit requirement changes
  if (newSecurity.auditRequired && !oldSecurity.auditRequired) {
    changes.push({
      type: BreakingChangeType.SecurityStricter,
      description: 'Audit logging is now required',
      severity: 'warning',
    });
  }

  return changes;
}

/**
 * Check compatibility between two type versions
 */
export function checkTypeCompatibility(
  oldType: TypeDefNode,
  newType: TypeDefNode
): CompatibilityResult {
  const breakingChanges: BreakingChange[] = [];
  const warnings: string[] = [];

  // Create field maps
  const oldFields = new Map(oldType.fields.map(f => [f.name, f]));
  const newFields = new Map(newType.fields.map(f => [f.name, f]));

  // Check for removed fields
  for (const [fieldName, oldField] of oldFields) {
    if (!newFields.has(fieldName)) {
      breakingChanges.push({
        type: BreakingChangeType.ParameterRemoved,
        description: `Field '${fieldName}' was removed`,
        severity: 'error',
      });
    } else {
      // Check type changes
      const newField = newFields.get(fieldName)!;
      const oldTypeStr = typeToString(oldField.fieldType);
      const newTypeStr = typeToString(newField.fieldType);

      if (oldTypeStr !== newTypeStr) {
        breakingChanges.push({
          type: BreakingChangeType.InputTypeChanged,
          description: `Field '${fieldName}' type changed from ${oldTypeStr} to ${newTypeStr}`,
          severity: 'error',
        });
      }

      // Check classification changes
      if (oldField.classification !== newField.classification) {
        if (isMoreRestrictive(newField.classification, oldField.classification)) {
          warnings.push(
            `Field '${fieldName}' classification became more restrictive: ` +
            `${oldField.classification} → ${newField.classification}`
          );
        } else {
          breakingChanges.push({
            type: BreakingChangeType.SecurityLoosened,
            description:
              `Field '${fieldName}' classification became less restrictive: ` +
              `${oldField.classification} → ${newField.classification}`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // Check for added fields (generally OK)
  for (const [fieldName] of newFields) {
    if (!oldFields.has(fieldName)) {
      warnings.push(`Field '${fieldName}' was added`);
    }
  }

  const level = determineCompatibilityLevel(breakingChanges);
  return { level, breakingChanges, warnings };
}

/**
 * Determine overall compatibility level
 */
function determineCompatibilityLevel(breakingChanges: BreakingChange[]): CompatibilityLevel {
  const errors = breakingChanges.filter(c => c.severity === 'error');

  if (errors.length > 0) {
    return CompatibilityLevel.Breaking;
  }

  if (breakingChanges.length > 0) {
    return CompatibilityLevel.BackwardCompatible;
  }

  return CompatibilityLevel.FullyCompatible;
}

/**
 * Convert TypeExprNode to string for comparison
 */
function typeToString(typeExpr: TypeExprNode): string {
  switch (typeExpr.type) {
    case 'PrimitiveType':
      return typeExpr.name;
    case 'NamedType':
      return typeExpr.version ? `${typeExpr.name}:${typeExpr.version}` : typeExpr.name;
    case 'GenericType':
      return `${typeExpr.constructor}<${typeExpr.typeArgs.map(typeToString).join(', ')}>`;
    case 'SumType':
      return typeExpr.variants.map(v => v.name).join(' | ');
    default:
      return 'unknown';
  }
}

/**
 * Check if a classification level is more restrictive
 */
function isMoreRestrictive(
  newLevel: string | undefined,
  oldLevel: string | undefined
): boolean {
  const levels = ['public', 'internal', 'confidential', 'restricted'];
  const newIndex = newLevel ? levels.indexOf(newLevel) : 0;
  const oldIndex = oldLevel ? levels.indexOf(oldLevel) : 0;
  return newIndex > oldIndex;
}

/**
 * Check if a version change should be a major bump
 */
export function shouldBeMajorVersion(
  oldFn: FunctionNode,
  newFn: FunctionNode
): boolean {
  const result = checkFunctionCompatibility(oldFn, newFn);
  return result.level === CompatibilityLevel.Breaking;
}

/**
 * Suggest version bump based on changes
 */
export function suggestVersionBump(
  oldFn: FunctionNode,
  newFn: FunctionNode
): 'major' | 'minor' | 'patch' {
  const result = checkFunctionCompatibility(oldFn, newFn);

  if (result.level === CompatibilityLevel.Breaking) {
    return 'major';
  }

  if (result.warnings.length > 0 || result.level === CompatibilityLevel.BackwardCompatible) {
    return 'minor';
  }

  return 'patch';
}
