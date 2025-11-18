/**
 * Migration Function System for CORE
 * Handles automatic version migration and validation
 */

import { FunctionNode, TypeDefNode } from '../ast/types';
import { SemanticVersion, compareVersions, VersionCompareResult } from './semver';
import { VersionRegistry } from './registry';
import { checkFunctionCompatibility, CompatibilityLevel } from './compatibility';

/**
 * Represents a migration function that converts between versions
 */
export interface MigrationFunction {
  name: string;
  fromVersion: SemanticVersion;
  toVersion: SemanticVersion;
  migrationFn: FunctionNode;
  validated: boolean;
  issues: string[];
}

/**
 * A complete migration path between two versions
 */
export interface MigrationPath {
  fromVersion: SemanticVersion;
  toVersion: SemanticVersion;
  steps: MigrationStep[];
  isComplete: boolean;
  totalSteps: number;
}

/**
 * A single step in a migration path
 */
export interface MigrationStep {
  fromVersion: SemanticVersion;
  toVersion: SemanticVersion;
  migration: MigrationFunction;
}

/**
 * Manages migration functions and paths
 */
export class MigrationRegistry {
  private migrations: Map<string, MigrationFunction[]>;

  constructor() {
    this.migrations = new Map();
  }

  /**
   * Register a migration function
   */
  register(
    targetFunction: string,
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    migrationFn: FunctionNode
  ): MigrationFunction {
    const migration: MigrationFunction = {
      name: `${targetFunction}_v${fromVersion.major}_${fromVersion.minor}_to_v${toVersion.major}_${toVersion.minor}`,
      fromVersion,
      toVersion,
      migrationFn,
      validated: false,
      issues: [],
    };

    // Get or create migration list for this function
    const fnMigrations = this.migrations.get(targetFunction) || [];
    fnMigrations.push(migration);
    this.migrations.set(targetFunction, fnMigrations);

    return migration;
  }

  /**
   * Validate a migration function against source and target versions
   */
  validate(
    migration: MigrationFunction,
    sourceVersion: FunctionNode,
    targetVersion: FunctionNode
  ): boolean {
    const issues: string[] = [];

    // Check that input signature of migration matches source
    if (!this.signaturesMatch(migration.migrationFn.signature.inputs, sourceVersion.signature.inputs)) {
      issues.push('Migration input signature does not match source function inputs');
    }

    // Check that output signature of migration matches target
    if (!this.signaturesMatch(migration.migrationFn.signature.outputs, targetVersion.signature.inputs)) {
      issues.push('Migration output signature does not match target function inputs');
    }

    // Migration must be pure and rollback-safe
    if (!migration.migrationFn.metadata.pure) {
      issues.push('Migration function must be pure (no side effects)');
    }

    if (!migration.migrationFn.version?.rollbackSafe) {
      issues.push('Migration function must be rollback-safe');
    }

    // Check that migration is addressing actual breaking changes
    const compatibility = checkFunctionCompatibility(sourceVersion, targetVersion);
    if (compatibility.level === CompatibilityLevel.FullyCompatible) {
      issues.push('No migration needed - versions are fully compatible');
    }

    migration.issues = issues;
    migration.validated = issues.length === 0;

    return migration.validated;
  }

  /**
   * Find a migration function between two versions
   */
  find(
    functionName: string,
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion
  ): MigrationFunction | undefined {
    const migrations = this.migrations.get(functionName);
    if (!migrations) return undefined;

    return migrations.find(
      m =>
        compareVersions(m.fromVersion, fromVersion) === VersionCompareResult.Equal &&
        compareVersions(m.toVersion, toVersion) === VersionCompareResult.Equal
    );
  }

  /**
   * Build a complete migration path between two versions
   */
  buildPath(
    functionName: string,
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    versionRegistry: VersionRegistry<FunctionNode>
  ): MigrationPath {
    const steps: MigrationStep[] = [];
    const replacementChain = versionRegistry.getReplacementChain(functionName, fromVersion);

    // Build migration steps following the replacement chain
    for (let i = 0; i < replacementChain.length - 1; i++) {
      const from = replacementChain[i];
      const to = replacementChain[i + 1];

      const migration = this.find(functionName, from, to);
      if (migration) {
        steps.push({ fromVersion: from, toVersion: to, migration });
      } else {
        // Missing migration - path is incomplete
        return {
          fromVersion,
          toVersion,
          steps,
          isComplete: false,
          totalSteps: replacementChain.length - 1,
        };
      }

      // Stop if we've reached the target
      if (compareVersions(to, toVersion) === VersionCompareResult.Equal) {
        break;
      }
    }

    const reachedTarget =
      steps.length > 0 &&
      compareVersions(steps[steps.length - 1].toVersion, toVersion) === VersionCompareResult.Equal;

    return {
      fromVersion,
      toVersion,
      steps,
      isComplete: reachedTarget,
      totalSteps: steps.length,
    };
  }

  /**
   * Get all migrations for a function
   */
  getAll(functionName: string): MigrationFunction[] {
    return this.migrations.get(functionName) || [];
  }

  /**
   * Get all validated migrations
   */
  getValidated(functionName: string): MigrationFunction[] {
    return this.getAll(functionName).filter(m => m.validated);
  }

  /**
   * Get all invalid migrations (for debugging)
   */
  getInvalid(functionName: string): MigrationFunction[] {
    return this.getAll(functionName).filter(m => !m.validated && m.issues.length > 0);
  }

  /**
   * Check if a complete migration path exists
   */
  hasPath(
    functionName: string,
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    versionRegistry: VersionRegistry<FunctionNode>
  ): boolean {
    const path = this.buildPath(functionName, fromVersion, toVersion, versionRegistry);
    return path.isComplete;
  }

  /**
   * Clear all migrations
   */
  clear(): void {
    this.migrations.clear();
  }

  /**
   * Check if two parameter lists match
   */
  private signaturesMatch(sig1: any[], sig2: any[]): boolean {
    if (sig1.length !== sig2.length) return false;

    for (let i = 0; i < sig1.length; i++) {
      if (!this.typeMatches(sig1[i].paramType, sig2[i].paramType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if two type expressions match (simplified)
   */
  private typeMatches(type1: any, type2: any): boolean {
    // Simplified type matching - could be expanded
    if (type1.type !== type2.type) return false;

    switch (type1.type) {
      case 'PrimitiveType':
        return type1.name === type2.name;
      case 'NamedType':
        return type1.name === type2.name;
      case 'GenericType':
        return (
          type1.constructor === type2.constructor &&
          type1.typeArgs.length === type2.typeArgs.length
        );
      default:
        return true; // Conservative match
    }
  }
}

/**
 * Analyzes migration coverage for a function
 */
export interface MigrationCoverage {
  functionName: string;
  totalVersionPairs: number;
  coveredPairs: number;
  missingMigrations: Array<{ from: SemanticVersion; to: SemanticVersion }>;
  coveragePercentage: number;
}

/**
 * Analyze migration coverage for a function
 */
export function analyzeMigrationCoverage(
  functionName: string,
  versionRegistry: VersionRegistry<FunctionNode>,
  migrationRegistry: MigrationRegistry
): MigrationCoverage {
  const versions = versionRegistry.getAllVersions(functionName);
  const missingMigrations: Array<{ from: SemanticVersion; to: SemanticVersion }> = [];

  let totalPairs = 0;
  let coveredPairs = 0;

  // Check each consecutive version pair
  for (let i = 0; i < versions.length - 1; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      const from = versions[i].version;
      const to = versions[j].version;

      totalPairs++;

      const migration = migrationRegistry.find(functionName, from, to);
      if (migration && migration.validated) {
        coveredPairs++;
      } else {
        missingMigrations.push({ from, to });
      }
    }
  }

  return {
    functionName,
    totalVersionPairs: totalPairs,
    coveredPairs,
    missingMigrations,
    coveragePercentage: totalPairs > 0 ? (coveredPairs / totalPairs) * 100 : 0,
  };
}

/**
 * Generate a migration function template
 */
export function generateMigrationTemplate(
  functionName: string,
  sourceVersion: FunctionNode,
  targetVersion: FunctionNode
): string {
  function formatType(typeExpr: any): string {
    switch (typeExpr.type) {
      case 'PrimitiveType':
        return `:${typeExpr.name}`;
      case 'NamedType':
        return typeExpr.name;
      case 'GenericType':
        return `(${typeExpr.constructor} ${typeExpr.typeArgs.map(formatType).join(' ')})`;
      default:
        return ':any';
    }
  }

  const fromVer = sourceVersion.version?.version || 'v1';
  const toVer = targetVersion.version?.version || 'v2';

  const migrationName = `${functionName}_${fromVer.replace(/\./g, '_')}_to_${toVer.replace(/\./g, '_')}`;

  const inputs = sourceVersion.signature.inputs
    .map(p => `(${p.name} ${formatType(p.paramType)})`)
    .join(' ');

  const outputs = targetVersion.signature.inputs
    .map(p => `(${p.name} ${formatType(p.paramType)})`)
    .join(' ');

  return `
; Migration function from ${fromVer} to ${toVer}
(fn ${migrationName} :v1
  :stability stable
  :rollback-safe true
  :pure true

  :inputs [${inputs}]
  :outputs [${outputs}]

  :doc "Migrate ${functionName} from ${fromVer} to ${toVer}"

  (body
    ; TODO: Implement migration logic
    ; Transform inputs from ${fromVer} format to ${toVer} format
    (${functionName}:${toVer}
      ; Add transformations here
      )))
`.trim();
}
