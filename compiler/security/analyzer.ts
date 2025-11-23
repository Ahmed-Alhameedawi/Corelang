/**
 * Security Analyzer
 * Performs static security analysis and validates RBAC rules
 */

import {
  ModuleNode,
  FunctionNode,
  RoleNode,
  PermissionNode,
  PolicyNode,
  ClassificationLevel,
  FieldDefNode,
  TypeDefNode,
} from '../ast/types';
import { DiagnosticBuilder } from '../diagnostics/diagnostic';

/**
 * Security context tracks roles, permissions, and policies
 */
export class SecurityContext {
  private roles: Map<string, RoleNode> = new Map();
  private permissions: Map<string, PermissionNode> = new Map();
  private policies: Map<string, PolicyNode> = new Map();
  private functions: Map<string, FunctionNode> = new Map();
  private types: Map<string, TypeDefNode> = new Map();

  /**
   * Register a role
   */
  registerRole(role: RoleNode): void {
    this.roles.set(role.name, role);
  }

  /**
   * Register a permission
   */
  registerPermission(perm: PermissionNode): void {
    this.permissions.set(perm.name, perm);
  }

  /**
   * Register a policy
   */
  registerPolicy(policy: PolicyNode): void {
    this.policies.set(policy.name, policy);
  }

  /**
   * Register a function
   */
  registerFunction(fn: FunctionNode): void {
    this.functions.set(fn.name, fn);
  }

  /**
   * Register a type
   */
  registerType(type: TypeDefNode): void {
    this.types.set(type.name, type);
  }

  /**
   * Get a role by name
   */
  getRole(name: string): RoleNode | undefined {
    return this.roles.get(name);
  }

  /**
   * Get a permission by name
   */
  getPermission(name: string): PermissionNode | undefined {
    return this.permissions.get(name);
  }

  /**
   * Get a policy by name
   */
  getPolicy(name: string): PolicyNode | undefined {
    return this.policies.get(name);
  }

  /**
   * Get all roles
   */
  getAllRoles(): RoleNode[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): PermissionNode[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get all policies
   */
  getAllPolicies(): PolicyNode[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get all functions
   */
  getAllFunctions(): FunctionNode[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get all types
   */
  getAllTypes(): TypeDefNode[] {
    return Array.from(this.types.values());
  }

  /**
   * Check if a role has a permission (including inherited)
   */
  roleHasPermission(roleName: string, permissionName: string): boolean {
    const role = this.getRole(roleName);
    if (!role) return false;

    // Check direct permissions
    if (role.permissions.includes(permissionName)) {
      return true;
    }

    // Check inherited permissions
    for (const parentRoleName of role.inherits) {
      if (this.roleHasPermission(parentRoleName, permissionName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for a role (including inherited)
   */
  getRolePermissions(roleName: string, visited: Set<string> = new Set()): string[] {
    const role = this.getRole(roleName);
    if (!role || visited.has(roleName)) return [];

    visited.add(roleName);
    const permissions = [...role.permissions];

    // Add inherited permissions
    for (const parentRoleName of role.inherits) {
      permissions.push(...this.getRolePermissions(parentRoleName, visited));
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.roles.clear();
    this.permissions.clear();
    this.policies.clear();
    this.functions.clear();
    this.types.clear();
  }
}

/**
 * Security Analyzer validates security rules and constraints
 */
export class SecurityAnalyzer {
  private context: SecurityContext;
  private diagnostics: DiagnosticBuilder;

  constructor(context: SecurityContext, diagnostics: DiagnosticBuilder) {
    this.context = context;
    this.diagnostics = diagnostics;
  }

  /**
   * Analyze a module for security issues
   */
  analyzeModule(module: ModuleNode): void {
    // First pass: register all security primitives
    for (const element of module.elements) {
      if (element.type === 'Role') {
        this.context.registerRole(element);
      } else if (element.type === 'Permission') {
        this.context.registerPermission(element);
      } else if (element.type === 'Policy') {
        this.context.registerPolicy(element);
      } else if (element.type === 'Function') {
        this.context.registerFunction(element);
      } else if (element.type === 'TypeDef') {
        this.context.registerType(element);
      }
    }

    // Second pass: validate references
    this.validateRoles();
    this.validatePolicies();
    this.validateFunctions();
    this.validateDataClassification();
  }

  /**
   * Validate role definitions
   */
  private validateRoles(): void {
    for (const role of this.context.getAllRoles()) {
      // Validate inherited roles exist
      for (const parentName of role.inherits) {
        if (!this.context.getRole(parentName)) {
          this.diagnostics.error(
            `Role '${role.name}' inherits from undefined role '${parentName}'`,
            role.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'SEC001'
          );
        }
      }

      // Check for circular inheritance
      if (this.hasCircularInheritance(role.name)) {
        this.diagnostics.error(
          `Role '${role.name}' has circular inheritance`,
          role.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
          'SEC002'
        );
      }

      // Validate permissions exist
      for (const permName of role.permissions) {
        if (!this.context.getPermission(permName)) {
          this.diagnostics.warning(
            `Role '${role.name}' references undefined permission '${permName}'`,
            role.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'SEC003'
          );
        }
      }
    }
  }

  /**
   * Validate policy definitions
   */
  private validatePolicies(): void {
    for (const policy of this.context.getAllPolicies()) {
      for (const rule of policy.rules) {
        // Validate roles exist
        for (const roleName of rule.roles) {
          if (!this.context.getRole(roleName)) {
            this.diagnostics.error(
              `Policy '${policy.name}' references undefined role '${roleName}'`,
              rule.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
              'SEC004'
            );
          }
        }

        // Validate permissions exist
        for (const permName of rule.permissions) {
          if (!this.context.getPermission(permName)) {
            this.diagnostics.warning(
              `Policy '${policy.name}' references undefined permission '${permName}'`,
              rule.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
              'SEC005'
            );
          }
        }
      }
    }
  }

  /**
   * Validate function security requirements
   */
  private validateFunctions(): void {
    for (const fn of this.context.getAllFunctions()) {
      // Validate required roles exist
      for (const roleName of fn.security.requiredRoles) {
        if (!this.context.getRole(roleName)) {
          this.diagnostics.error(
            `Function '${fn.name}' requires undefined role '${roleName}'`,
            fn.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'SEC006'
          );
        }
      }

      // Validate required permissions exist
      for (const permName of fn.security.requiredPermissions) {
        if (!this.context.getPermission(permName)) {
          this.diagnostics.warning(
            `Function '${fn.name}' requires undefined permission '${permName}'`,
            fn.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'SEC007'
          );
        }
      }

      // Warn if function handles secrets without audit
      if (fn.security.handlesSecrets && !fn.security.auditRequired) {
        this.diagnostics
          .warning(
            `Function '${fn.name}' handles secrets but audit is not required`,
            fn.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
            'SEC008'
          )
          .withHint('Consider setting :audit-required true for functions that handle secrets');
      }
    }
  }

  /**
   * Validate data classification levels
   */
  private validateDataClassification(): void {
    for (const type of this.context.getAllTypes()) {
      const maxClassification = this.getMaxClassification(type.fields);

      // Check if any confidential/restricted data lacks proper permissions
      if (maxClassification === 'confidential' || maxClassification === 'restricted') {
        // Find functions that use this type
        for (const fn of this.context.getAllFunctions()) {
          const usesType = this.functionUsesType(fn, type.name);
          if (usesType && !fn.security.auditRequired) {
            this.diagnostics.warning(
              `Function '${fn.name}' uses type '${type.name}' with ${maxClassification} data but audit is not required`,
              fn.loc || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
              'SEC009'
            );
          }
        }
      }
    }
  }

  /**
   * Check if a role has circular inheritance
   */
  private hasCircularInheritance(roleName: string, visited: Set<string> = new Set()): boolean {
    if (visited.has(roleName)) {
      return true;
    }

    const role = this.context.getRole(roleName);
    if (!role) return false;

    visited.add(roleName);

    for (const parentName of role.inherits) {
      if (this.hasCircularInheritance(parentName, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the maximum classification level from a list of fields
   */
  private getMaxClassification(fields: FieldDefNode[]): ClassificationLevel {
    const levels: ClassificationLevel[] = ['public', 'internal', 'confidential', 'restricted'];
    let maxLevel: ClassificationLevel = 'public';

    for (const field of fields) {
      if (field.classification) {
        const currentIndex = levels.indexOf(field.classification);
        const maxIndex = levels.indexOf(maxLevel);
        if (currentIndex > maxIndex) {
          maxLevel = field.classification;
        }
      }
    }

    return maxLevel;
  }

  /**
   * Check if a function uses a specific type
   */
  private functionUsesType(fn: FunctionNode, typeName: string): boolean {
    // Check inputs
    for (const param of fn.signature.inputs) {
      if (this.typeExprUsesType(param.paramType, typeName)) {
        return true;
      }
    }

    // Check outputs
    for (const param of fn.signature.outputs) {
      if (this.typeExprUsesType(param.paramType, typeName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a type expression references a specific type
   */
  private typeExprUsesType(typeExpr: any, typeName: string): boolean {
    if (typeExpr.type === 'NamedType') {
      return typeExpr.name === typeName;
    } else if (typeExpr.type === 'GenericType') {
      for (const arg of typeExpr.typeArgs) {
        if (this.typeExprUsesType(arg, typeName)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a role can access a function based on policies
   */
  canRoleAccessFunction(roleName: string, functionName: string): boolean {
    const fn = this.context.getAllFunctions().find(f => f.name === functionName);
    if (!fn) return false;

    // Check if role meets function's requirements
    for (const requiredRole of fn.security.requiredRoles) {
      if (requiredRole === roleName || this.roleInheritsFrom(roleName, requiredRole)) {
        return true;
      }
    }

    // Check permissions
    for (const requiredPerm of fn.security.requiredPermissions) {
      if (this.context.roleHasPermission(roleName, requiredPerm)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a role inherits from another role
   */
  private roleInheritsFrom(roleName: string, ancestorName: string, visited: Set<string> = new Set()): boolean {
    if (roleName === ancestorName) return true;
    if (visited.has(roleName)) return false;

    const role = this.context.getRole(roleName);
    if (!role) return false;

    visited.add(roleName);

    for (const parentName of role.inherits) {
      if (this.roleInheritsFrom(parentName, ancestorName, visited)) {
        return true;
      }
    }

    return false;
  }
}
