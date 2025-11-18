/**
 * Compiler Context
 * Provides unified access to version registries, diagnostics, and compilation state
 */

import { ModuleNode, FunctionNode, TypeDefNode } from './ast/types';
import { ModuleVersionRegistry } from './versioning/registry';
import { MigrationRegistry } from './versioning/migration';
import { DiagnosticBuilder } from './diagnostics/diagnostic';
import { checkFunctionCompatibility, checkTypeCompatibility } from './versioning/compatibility';
import { parseVersion, parseConstraint } from './versioning/semver';

/**
 * Compilation options
 */
export interface CompilerOptions {
  strictVersioning?: boolean;
  warnOnDeprecated?: boolean;
  requireMigrations?: boolean;
  allowUnstableVersions?: boolean;
}

/**
 * Compiler context holds all state for a compilation session
 */
export class CompilerContext {
  public versionRegistry: ModuleVersionRegistry;
  public migrationRegistry: MigrationRegistry;
  public diagnostics: DiagnosticBuilder;
  public options: CompilerOptions;

  private modules: Map<string, ModuleNode>;
  private currentModule?: string;

  constructor(options: CompilerOptions = {}) {
    this.versionRegistry = new ModuleVersionRegistry();
    this.migrationRegistry = new MigrationRegistry();
    this.diagnostics = new DiagnosticBuilder();
    this.options = {
      strictVersioning: true,
      warnOnDeprecated: true,
      requireMigrations: false,
      allowUnstableVersions: false,
      ...options,
    };
    this.modules = new Map();
  }

  /**
   * Register a module and all its entities
   */
  registerModule(module: ModuleNode): void {
    this.currentModule = module.name;
    this.modules.set(module.name, module);

    // Extract functions and types from module elements
    const functions: FunctionNode[] = [];
    const types: TypeDefNode[] = [];
    const validFunctions: FunctionNode[] = [];
    const validTypes: TypeDefNode[] = [];

    for (const element of module.elements) {
      if (element.type === 'Function') {
        functions.push(element);

        // Validate function versioning
        if (element.version?.version) {
          const isValid = this.validateFunctionVersion(element);
          if (isValid) {
            validFunctions.push(element);
          }
        } else {
          validFunctions.push(element);
        }
      } else if (element.type === 'TypeDef') {
        types.push(element);

        // Validate type versioning
        if (element.version?.version) {
          const isValid = this.validateTypeVersion(element);
          if (isValid) {
            validTypes.push(element);
          }
        } else {
          validTypes.push(element);
        }
      }
    }

    // Register only valid versions with version registry
    this.versionRegistry.registerModule({ functions: validFunctions, types: validTypes });
  }

  /**
   * Validate a function version
   */
  private validateFunctionVersion(fn: FunctionNode): boolean {
    const fnName = fn.name;
    const versionStr = fn.version?.version;

    if (!versionStr) return true;

    const version = parseVersion(versionStr);
    if (!version) {
      this.diagnostics.error(
        `Invalid version string: ${versionStr}`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER001'
      );
      return false;
    }

    // Check if this replaces an older version
    if (fn.version?.replaces && fn.version.replaces.length > 0) {
      const replacesStr = fn.version.replaces[0];
      const replacesVersion = parseVersion(replacesStr);

      if (!replacesVersion) {
        this.diagnostics.error(
          `Invalid replacement version: ${replacesStr}`,
          { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
          'VER002'
        );
        return false;
      }

      // Get the old version to compare
      const oldVersion = this.versionRegistry.functions.get(fnName, replacesVersion);
      if (oldVersion) {
        // Check compatibility
        const compat = checkFunctionCompatibility(oldVersion.node, fn);

        // If there are breaking changes, ensure version incremented appropriately
        if (compat.level === 'breaking' && version.major === oldVersion.version.major) {
          this.diagnostics.error(
            `Breaking changes require major version increment (${oldVersion.version.major}.x.x -> ${version.major + 1}.0.0)`,
            { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'VER003'
          );
        }

        // Report breaking changes as warnings
        for (const change of compat.breakingChanges) {
          if (change.severity === 'error') {
            this.diagnostics.warning(
              `Breaking change in ${fnName}:${versionStr}: ${change.description}`,
              { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
              'VER004'
            );
          }
        }
      }
    }

    // Warn on deprecated versions
    if (this.options.warnOnDeprecated && fn.version?.stability === 'deprecated') {
      this.diagnostics.warning(
        `Function ${fnName}:${versionStr} is deprecated`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER005'
      );
    }

    // Warn on unstable versions if not allowed
    if (!this.options.allowUnstableVersions &&
        (fn.version?.stability === 'alpha' || fn.version?.stability === 'beta')) {
      this.diagnostics.warning(
        `Function ${fnName}:${versionStr} is ${fn.version.stability} (unstable)`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER006'
      );
    }

    return true;
  }

  /**
   * Validate a type version
   */
  private validateTypeVersion(type: TypeDefNode): boolean {
    const typeName = type.name;
    const versionStr = type.version?.version;

    if (!versionStr) return true;

    const version = parseVersion(versionStr);
    if (!version) {
      this.diagnostics.error(
        `Invalid version string: ${versionStr}`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER001'
      );
      return false;
    }

    // Check if this replaces an older version
    if (type.version?.replaces && type.version.replaces.length > 0) {
      const replacesStr = type.version.replaces[0];
      const replacesVersion = parseVersion(replacesStr);

      if (!replacesVersion) {
        this.diagnostics.error(
          `Invalid replacement version: ${replacesStr}`,
          { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
          'VER002'
        );
        return false;
      }

      // Get the old version to compare
      const oldVersion = this.versionRegistry.types.get(typeName, replacesVersion);
      if (oldVersion) {
        // Check compatibility
        const compat = checkTypeCompatibility(oldVersion.node, type);

        // Report breaking changes
        if (compat.breakingChanges.length > 0) {
          for (const change of compat.breakingChanges) {
            this.diagnostics.warning(
              `Breaking change in ${typeName}:${versionStr}: ${change.description}`,
              { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
              'VER007'
            );
          }
        }
      }
    }

    return true;
  }

  /**
   * Resolve a version constraint for a function
   */
  resolveFunctionVersion(name: string, constraintStr: string): FunctionNode | undefined {
    const constraint = parseConstraint(constraintStr);
    if (!constraint) {
      this.diagnostics.error(
        `Invalid version constraint: ${constraintStr}`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER008'
      );
      return undefined;
    }

    const resolved = this.versionRegistry.functions.resolve(name, constraint);
    if (!resolved) {
      this.diagnostics.error(
        `No version of function '${name}' satisfies constraint '${constraintStr}'`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER009'
      );
      return undefined;
    }

    return resolved.node;
  }

  /**
   * Resolve a version constraint for a type
   */
  resolveTypeVersion(name: string, constraintStr: string): TypeDefNode | undefined {
    const constraint = parseConstraint(constraintStr);
    if (!constraint) {
      this.diagnostics.error(
        `Invalid version constraint: ${constraintStr}`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER008'
      );
      return undefined;
    }

    const resolved = this.versionRegistry.types.resolve(name, constraint);
    if (!resolved) {
      this.diagnostics.error(
        `No version of type '${name}' satisfies constraint '${constraintStr}'`,
        { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        'VER010'
      );
      return undefined;
    }

    return resolved.node;
  }

  /**
   * Get a module by name
   */
  getModule(name: string): ModuleNode | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleNode[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get version statistics for all entities
   */
  getVersionStats() {
    return this.versionRegistry.getOverallStats();
  }

  /**
   * Check if compilation has errors
   */
  hasErrors(): boolean {
    return this.diagnostics.hasErrors();
  }

  /**
   * Get all diagnostics
   */
  getDiagnostics() {
    return this.diagnostics.build();
  }

  /**
   * Reset the context
   */
  reset(): void {
    this.versionRegistry.clear();
    this.migrationRegistry.clear();
    this.diagnostics = new DiagnosticBuilder();
    this.modules.clear();
    this.currentModule = undefined;
  }
}
