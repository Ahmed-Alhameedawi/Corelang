/**
 * Version Registry for CORE
 * Tracks all versions of functions and types, manages replacement chains
 */

import { FunctionNode, TypeDefNode, StabilityLevel } from '../ast/types';
import {
  SemanticVersion,
  VersionConstraint,
  parseVersion,
  compareVersions,
  satisfiesConstraint,
  VersionCompareResult,
} from './semver';

/**
 * Metadata about a versioned entity
 */
export interface VersionedEntity<T> {
  name: string;
  version: SemanticVersion;
  stability: StabilityLevel;
  node: T;
  replacedBy?: SemanticVersion;
  replaces?: SemanticVersion;
  deprecatedSince?: string;
  isRollbackSafe: boolean;
}

/**
 * Version chain representing evolution of a function/type
 */
export interface VersionChain<T> {
  name: string;
  versions: Map<string, VersionedEntity<T>>;
  latestVersion?: SemanticVersion;
  latestStableVersion?: SemanticVersion;
}

/**
 * Registry for managing versioned functions and types
 */
export class VersionRegistry<T extends FunctionNode | TypeDefNode> {
  private chains: Map<string, VersionChain<T>>;

  constructor() {
    this.chains = new Map();
  }

  /**
   * Register a new version of a function or type
   */
  register(entity: T): void {
    const name = entity.name;
    const versionStr = entity.version?.version;

    if (!versionStr) {
      throw new Error(`Entity ${name} must have a version`);
    }

    const version = parseVersion(versionStr);
    if (!version) {
      throw new Error(`Invalid version string: ${versionStr}`);
    }

    // Get or create chain
    let chain = this.chains.get(name);
    if (!chain) {
      chain = {
        name,
        versions: new Map(),
      };
      this.chains.set(name, chain);
    }

    // Create versioned entity
    const versionKey = this.versionKey(version);
    const versioned: VersionedEntity<T> = {
      name,
      version,
      stability: entity.version?.stability || 'alpha',
      node: entity,
      isRollbackSafe: this.extractRollbackSafe(entity),
    };

    // Handle replacement metadata
    if (entity.version?.replaces && entity.version.replaces.length > 0) {
      // Take the first replacement (most direct predecessor)
      const replacesVersion = parseVersion(entity.version.replaces[0]);
      if (replacesVersion) {
        versioned.replaces = replacesVersion;

        // Update the replaced version to point forward
        const replacedKey = this.versionKey(replacesVersion);
        const replacedEntity = chain.versions.get(replacedKey);
        if (replacedEntity) {
          replacedEntity.replacedBy = version;
        }
      }
    }

    // Handle deprecation
    if (entity.version?.deprecated) {
      versioned.deprecatedSince = 'unknown'; // AST only has boolean
    }

    // Add to chain
    chain.versions.set(versionKey, versioned);

    // Update latest version
    if (!chain.latestVersion || compareVersions(version, chain.latestVersion) === VersionCompareResult.Greater) {
      chain.latestVersion = version;
    }

    // Update latest stable version
    if (versioned.stability === 'stable') {
      if (!chain.latestStableVersion ||
          compareVersions(version, chain.latestStableVersion) === VersionCompareResult.Greater) {
        chain.latestStableVersion = version;
      }
    }
  }

  /**
   * Get a specific version of an entity
   */
  get(name: string, version: SemanticVersion): VersionedEntity<T> | undefined {
    const chain = this.chains.get(name);
    if (!chain) return undefined;

    const versionKey = this.versionKey(version);
    return chain.versions.get(versionKey);
  }

  /**
   * Get the latest version of an entity
   */
  getLatest(name: string): VersionedEntity<T> | undefined {
    const chain = this.chains.get(name);
    if (!chain || !chain.latestVersion) return undefined;

    return this.get(name, chain.latestVersion);
  }

  /**
   * Get the latest stable version of an entity
   */
  getLatestStable(name: string): VersionedEntity<T> | undefined {
    const chain = this.chains.get(name);
    if (!chain || !chain.latestStableVersion) return undefined;

    return this.get(name, chain.latestStableVersion);
  }

  /**
   * Resolve a version constraint to the best matching version
   */
  resolve(name: string, constraint: VersionConstraint): VersionedEntity<T> | undefined {
    const chain = this.chains.get(name);
    if (!chain) return undefined;

    // Handle special constraints
    if (constraint.type === 'latest') {
      return this.getLatest(name);
    }

    if (constraint.type === 'stable') {
      return this.getLatestStable(name);
    }

    // Get all versions that satisfy the constraint
    const matching = Array.from(chain.versions.values())
      .filter(entity => satisfiesConstraint(entity.version, constraint));

    if (matching.length === 0) return undefined;

    // Sort by version (descending) and return the highest
    matching.sort((a, b) => -compareVersions(a.version, b.version));
    return matching[0];
  }

  /**
   * Get all versions of an entity
   */
  getAllVersions(name: string): VersionedEntity<T>[] {
    const chain = this.chains.get(name);
    if (!chain) return [];

    return Array.from(chain.versions.values())
      .sort((a, b) => compareVersions(a.version, b.version));
  }

  /**
   * Get all deprecated versions
   */
  getDeprecated(name: string): VersionedEntity<T>[] {
    return this.getAllVersions(name)
      .filter(entity => entity.stability === 'deprecated' || entity.deprecatedSince);
  }

  /**
   * Get the replacement chain for a version
   */
  getReplacementChain(name: string, version: SemanticVersion): SemanticVersion[] {
    const chain: SemanticVersion[] = [version];
    let current = this.get(name, version);

    while (current?.replacedBy) {
      chain.push(current.replacedBy);
      current = this.get(name, current.replacedBy);
    }

    return chain;
  }

  /**
   * Get the predecessor chain for a version
   */
  getPredecessorChain(name: string, version: SemanticVersion): SemanticVersion[] {
    const chain: SemanticVersion[] = [version];
    let current = this.get(name, version);

    while (current?.replaces) {
      chain.unshift(current.replaces);
      current = this.get(name, current.replaces);
    }

    return chain;
  }

  /**
   * Check if a migration path exists between two versions
   */
  hasMigrationPath(name: string, from: SemanticVersion, to: SemanticVersion): boolean {
    const chain = this.getReplacementChain(name, from);
    return chain.some(v => compareVersions(v, to) === VersionCompareResult.Equal);
  }

  /**
   * Get all entity names in the registry
   */
  getAllNames(): string[] {
    return Array.from(this.chains.keys());
  }

  /**
   * Check if an entity exists
   */
  has(name: string): boolean {
    return this.chains.has(name);
  }

  /**
   * Get statistics about an entity's versions
   */
  getStats(name: string): VersionStats | undefined {
    const chain = this.chains.get(name);
    if (!chain) return undefined;

    const versions = Array.from(chain.versions.values());

    return {
      name,
      totalVersions: versions.length,
      stableVersions: versions.filter(v => v.stability === 'stable').length,
      deprecatedVersions: versions.filter(v => v.stability === 'deprecated' || v.deprecatedSince).length,
      betaVersions: versions.filter(v => v.stability === 'beta').length,
      alphaVersions: versions.filter(v => v.stability === 'alpha').length,
      latestVersion: chain.latestVersion,
      latestStableVersion: chain.latestStableVersion,
    };
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.chains.clear();
  }

  /**
   * Generate a version key for indexing
   */
  private versionKey(version: SemanticVersion): string {
    return `${version.major}.${version.minor}.${version.patch}${
      version.prerelease ? `-${version.prerelease}` : ''
    }`;
  }

  /**
   * Extract rollback-safe flag from entity
   */
  private extractRollbackSafe(entity: T): boolean {
    return entity.version?.rollbackSafe ?? false;
  }
}

/**
 * Statistics about version distribution
 */
export interface VersionStats {
  name: string;
  totalVersions: number;
  stableVersions: number;
  deprecatedVersions: number;
  betaVersions: number;
  alphaVersions: number;
  latestVersion?: SemanticVersion;
  latestStableVersion?: SemanticVersion;
}

/**
 * Create separate registries for functions and types
 */
export class ModuleVersionRegistry {
  public functions: VersionRegistry<FunctionNode>;
  public types: VersionRegistry<TypeDefNode>;

  constructor() {
    this.functions = new VersionRegistry<FunctionNode>();
    this.types = new VersionRegistry<TypeDefNode>();
  }

  /**
   * Register all entities from a module
   */
  registerModule(module: { functions?: FunctionNode[]; types?: TypeDefNode[] }): void {
    if (module.functions) {
      for (const fn of module.functions) {
        if (fn.version?.version) {
          this.functions.register(fn);
        }
      }
    }

    if (module.types) {
      for (const type of module.types) {
        if (type.version?.version) {
          this.types.register(type);
        }
      }
    }
  }

  /**
   * Clear all registries
   */
  clear(): void {
    this.functions.clear();
    this.types.clear();
  }

  /**
   * Get combined statistics
   */
  getOverallStats(): {
    functions: Map<string, VersionStats>;
    types: Map<string, VersionStats>;
  } {
    const functionStats = new Map<string, VersionStats>();
    const typeStats = new Map<string, VersionStats>();

    for (const name of this.functions.getAllNames()) {
      const stats = this.functions.getStats(name);
      if (stats) functionStats.set(name, stats);
    }

    for (const name of this.types.getAllNames()) {
      const stats = this.types.getStats(name);
      if (stats) typeStats.set(name, stats);
    }

    return { functions: functionStats, types: typeStats };
  }
}
