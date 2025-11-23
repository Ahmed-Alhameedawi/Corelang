/**
 * Effect Handler Registry
 *
 * Central registry for all effect handlers.
 */

import { Value } from '../vm/value.js';
import { Principal } from '../vm/vm.js';
import { ClassificationLevel } from '../vm/value.js';

/**
 * Effect metadata
 */
export interface EffectMetadata {
  classification?: ClassificationLevel;
  auditRequired?: boolean;
  resource?: string; // e.g., table name, URL, file path
}

/**
 * Effect handler interface
 */
export interface EffectHandler {
  name: string; // e.g., "db", "http", "fs"

  /**
   * Execute effect with security context
   */
  execute(
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value>;

  /**
   * Check if principal has permission
   */
  checkPermission(operation: string, principal: Principal): boolean;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  principal: string;
  effect: string;
  operation: string;
  params: any[];
  result?: any;
  error?: string;
  success: boolean;
}

/**
 * Audit logger
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];

  log(entry: AuditLogEntry): void {
    this.logs.push(entry);
    // In production, this would write to a secure audit trail
    console.log('[AUDIT]', JSON.stringify(entry));
  }

  getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Effect handler registry
 */
export class EffectHandlerRegistry {
  private handlers: Map<string, EffectHandler> = new Map();
  private auditLogger: AuditLogger = new AuditLogger();

  /**
   * Register an effect handler
   */
  register(handler: EffectHandler): void {
    this.handlers.set(handler.name, handler);
  }

  /**
   * Unregister an effect handler
   */
  unregister(name: string): void {
    this.handlers.delete(name);
  }

  /**
   * Check if an effect handler is registered
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get an effect handler
   */
  get(name: string): EffectHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Check permission for an effect
   */
  checkPermission(handler: string, operation: string, principal: Principal): boolean {
    const effectHandler = this.handlers.get(handler);
    if (!effectHandler) {
      return false;
    }
    return effectHandler.checkPermission(operation, principal);
  }

  /**
   * Execute an effect
   */
  async execute(
    handler: string,
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    // Get handler
    const effectHandler = this.handlers.get(handler);
    if (!effectHandler) {
      throw new Error(`Unknown effect handler: ${handler}`);
    }

    // Check permission
    if (!effectHandler.checkPermission(operation, principal)) {
      const error = `Permission denied: ${handler}.${operation} for principal ${principal.id}`;

      // Audit failed permission check
      if (metadata.auditRequired) {
        this.auditLogger.log({
          timestamp: new Date(),
          principal: principal.id,
          effect: handler,
          operation,
          params: params.map(p => this.serializeForAudit(p, metadata.classification)),
          error,
          success: false,
        });
      }

      throw new Error(error);
    }

    // Execute effect with audit logging
    let result: Value;
    let error: string | undefined;
    let success = true;

    try {
      result = await effectHandler.execute(operation, params, principal, metadata);
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);

      // Audit failure
      if (metadata.auditRequired) {
        this.auditLogger.log({
          timestamp: new Date(),
          principal: principal.id,
          effect: handler,
          operation,
          params: params.map(p => this.serializeForAudit(p, metadata.classification)),
          error,
          success: false,
        });
      }

      throw e;
    }

    // Audit success
    if (metadata.auditRequired) {
      this.auditLogger.log({
        timestamp: new Date(),
        principal: principal.id,
        effect: handler,
        operation,
        params: params.map(p => this.serializeForAudit(p, metadata.classification)),
        result: this.serializeForAudit(result, metadata.classification),
        success: true,
      });
    }

    return result;
  }

  /**
   * Serialize value for audit log with classification-aware redaction
   */
  private serializeForAudit(value: Value, classification?: ClassificationLevel): any {
    // Redact confidential and restricted data
    if (classification === 'confidential' || classification === 'restricted') {
      return '[REDACTED]';
    }

    // For internal data, include limited information
    if (classification === 'internal') {
      return {
        type: value.type,
        // Don't include actual value
      };
    }

    // For public data, include full value
    switch (value.type) {
      case 'unit':
        return null;
      case 'bool':
      case 'int':
      case 'float':
      case 'string':
        return value.value;
      case 'record':
        // Redact based on field classification
        const fields: any = {};
        value.fields.forEach((v, k) => {
          fields[k] = this.serializeForAudit(v, value.classification);
        });
        return { type: value.typeName, fields };
      case 'list':
        return value.value.map(v => this.serializeForAudit(v, classification));
      default:
        return { type: value.type };
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogger.getLogs();
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogger.clear();
  }
}
