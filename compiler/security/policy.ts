/**
 * Policy Evaluation Engine
 * Runtime policy evaluation for access control decisions
 */

import { PolicyNode, RuleNode, FunctionNode } from '../ast/types';
import { SecurityContext } from './analyzer';
import { parseVersion, parseConstraint, satisfiesConstraint } from '../versioning/semver';

/**
 * Access decision result
 */
export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedRule?: RuleNode;
  policy?: string;
}

/**
 * Evaluation context for policy decisions
 */
export interface EvaluationContext {
  role: string;
  functionName: string;
  functionVersion?: string;
}

/**
 * Policy evaluation engine
 */
export class PolicyEvaluator {
  private securityContext: SecurityContext;

  constructor(securityContext: SecurityContext) {
    this.securityContext = securityContext;
  }

  /**
   * Evaluate if a role can access a function
   */
  evaluate(context: EvaluationContext): AccessDecision {
    const { role, functionName, functionVersion } = context;

    // Check if role exists
    const roleObj = this.securityContext.getRole(role);
    if (!roleObj) {
      return {
        allowed: false,
        reason: `Role '${role}' does not exist`,
      };
    }

    // Get all effective roles (including inherited)
    const effectiveRoles = this.getEffectiveRoles(role);

    // Get all policies
    const policies = this.securityContext.getAllPolicies();

    // Collect all deny and allow decisions
    const denyDecisions: AccessDecision[] = [];
    const allowDecisions: AccessDecision[] = [];

    for (const policy of policies) {
      const decisions = this.evaluatePolicy(policy, effectiveRoles, functionName, functionVersion);

      for (const decision of decisions) {
        if (decision.matchedRule) {
          if (decision.matchedRule.effect === 'deny') {
            denyDecisions.push(decision);
          } else if (decision.matchedRule.effect === 'allow') {
            allowDecisions.push(decision);
          }
        }
      }
    }

    // Explicit deny always takes precedence
    if (denyDecisions.length > 0) {
      return denyDecisions[0];
    }

    // Return first allow if any
    if (allowDecisions.length > 0) {
      return allowDecisions[0];
    }

    // If no policies exist, fall back to checking function's required roles
    if (policies.length === 0) {
      const functions = this.securityContext.getAllFunctions();
      const fn = functions.find(f => f.name === functionName);

      if (fn && fn.security.requiredRoles.length > 0) {
        const hasRequiredRole = fn.security.requiredRoles.some(requiredRole =>
          effectiveRoles.includes(requiredRole)
        );

        if (hasRequiredRole) {
          return {
            allowed: true,
            reason: `Role '${role}' has required role for function '${functionName}' (no policies defined)`,
          };
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching policy rule found',
    };
  }

  /**
   * Evaluate a specific policy
   * Returns all matching decisions (both allow and deny)
   */
  private evaluatePolicy(
    policy: PolicyNode,
    effectiveRoles: string[],
    functionName: string,
    functionVersion?: string
  ): AccessDecision[] {
    const decisions: AccessDecision[] = [];

    for (const rule of policy.rules) {
      // Check if any of the effective roles match the rule
      const roleMatches = rule.roles.some(ruleRole => effectiveRoles.includes(ruleRole));
      if (!roleMatches) {
        continue;
      }

      // Check if function is covered by rule's permissions
      const functions = this.securityContext.getAllFunctions();
      const fn = functions.find(f => f.name === functionName);

      if (!fn) {
        continue;
      }

      // Check if function requires any of the rule's permissions
      const permissionMatches = this.checkPermissions(fn, rule.permissions);
      if (!permissionMatches) {
        continue;
      }

      // Check version constraint if specified
      if (rule.versionConstraint && functionVersion) {
        if (!this.checkVersionConstraint(functionVersion, rule.versionConstraint)) {
          continue;
        }
      }

      // Rule matches - add to decisions
      decisions.push({
        allowed: rule.effect === 'allow',
        reason: rule.effect === 'allow'
          ? `Policy '${policy.name}' allows access: ${rule.reason || 'rule matched'}`
          : `Policy '${policy.name}' denies access: ${rule.reason || 'rule matched'}`,
        matchedRule: rule,
        policy: policy.name,
      });
    }

    return decisions;
  }

  /**
   * Check if function requires any of the specified permissions
   */
  private checkPermissions(fn: FunctionNode, rulePermissions: string[]): boolean {
    // If function has required permissions, check if any match
    if (fn.security.requiredPermissions.length > 0) {
      return fn.security.requiredPermissions.some(perm =>
        rulePermissions.includes(perm)
      );
    }

    // Otherwise, check by function name convention (e.g., user.read permission for read_user function)
    // This is a heuristic - in practice, functions should declare required permissions
    return rulePermissions.some(perm => {
      const permParts = perm.split('.');
      const fnNameLower = fn.name.toLowerCase();
      return permParts.some(part => fnNameLower.includes(part.toLowerCase()));
    });
  }

  /**
   * Check if version satisfies constraint
   */
  private checkVersionConstraint(versionStr: string, constraint: any): boolean {
    const version = parseVersion(versionStr);
    if (!version) return false;

    switch (constraint.type) {
      case 'all':
        return true;

      case 'stable-only':
        // For stable-only, we need the version to be stable (no prerelease)
        return !version.prerelease;

      case 'specific':
        // Check if version is in the allowed list
        return constraint.versions.some((v: string) => {
          const constraintVersion = parseVersion(v);
          return constraintVersion &&
                 version.major === constraintVersion.major &&
                 version.minor === constraintVersion.minor &&
                 version.patch === constraintVersion.patch;
        });

      case 'range':
        // Use constraint parser for range
        const parsedConstraint = parseConstraint(constraint.range);
        return parsedConstraint ? satisfiesConstraint(version, parsedConstraint) : false;

      default:
        return false;
    }
  }

  /**
   * Get all effective roles (including inherited)
   */
  private getEffectiveRoles(roleName: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(roleName)) {
      return []; // Circular reference
    }

    visited.add(roleName);
    const roles = [roleName];

    const role = this.securityContext.getRole(roleName);
    if (!role) {
      return roles;
    }

    // Add inherited roles
    for (const parentRole of role.inherits) {
      roles.push(...this.getEffectiveRoles(parentRole, visited));
    }

    return [...new Set(roles)]; // Remove duplicates
  }

  /**
   * Bulk evaluate access for multiple functions
   */
  evaluateBulk(role: string, functionNames: string[]): Map<string, AccessDecision> {
    const results = new Map<string, AccessDecision>();

    for (const functionName of functionNames) {
      const decision = this.evaluate({ role, functionName });
      results.set(functionName, decision);
    }

    return results;
  }

  /**
   * Get all accessible functions for a role
   */
  getAccessibleFunctions(role: string): FunctionNode[] {
    const functions = this.securityContext.getAllFunctions();
    const accessible: FunctionNode[] = [];

    for (const fn of functions) {
      const decision = this.evaluate({ role, functionName: fn.name });
      if (decision.allowed) {
        accessible.push(fn);
      }
    }

    return accessible;
  }

  /**
   * Get detailed access report for a role
   */
  getAccessReport(role: string): {
    role: string;
    totalFunctions: number;
    accessibleFunctions: number;
    deniedFunctions: number;
    decisions: Map<string, AccessDecision>;
  } {
    const functions = this.securityContext.getAllFunctions();
    const decisions = new Map<string, AccessDecision>();
    let accessible = 0;
    let denied = 0;

    for (const fn of functions) {
      const decision = this.evaluate({ role, functionName: fn.name });
      decisions.set(fn.name, decision);

      if (decision.allowed) {
        accessible++;
      } else {
        denied++;
      }
    }

    return {
      role,
      totalFunctions: functions.length,
      accessibleFunctions: accessible,
      deniedFunctions: denied,
      decisions,
    };
  }
}
