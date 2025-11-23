/**
 * Logging Effect Handler
 *
 * Handles logging operations with classification-aware redaction.
 */

import { Value, ValueFactory, ValueTypeChecker, ValueOps, ClassificationLevel } from '../vm/value.js';
import { Principal } from '../vm/vm.js';
import { EffectHandler, EffectMetadata } from './registry.js';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  principal: string;
  classification?: ClassificationLevel;
  metadata?: Record<string, any>;
}

/**
 * Logging effect handler
 */
export class LoggingEffectHandler implements EffectHandler {
  name = 'log';

  // Log storage
  private logs: LogEntry[] = [];

  /**
   * Execute logging operation
   */
  async execute(
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    // Operation is the log level (debug, info, warn, error)
    const level = operation as LogLevel;

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
      throw new Error(`Unknown log level: ${level}`);
    }

    return this.log(level, params, principal, metadata);
  }

  /**
   * Check permission
   */
  checkPermission(operation: string, principal: Principal): boolean {
    // Everyone can log
    return true;
  }

  /**
   * Log a message
   */
  private async log(
    level: LogLevel,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('log requires a message'));
    }

    const message = params[0];

    // Redact message based on classification
    const redacted = this.redactValue(message, metadata.classification);

    // Extract metadata if provided
    const logMetadata: Record<string, any> = {};
    if (params.length > 1 && ValueTypeChecker.isMap(params[1])) {
      const metaMap = params[1];
      metaMap.value.forEach((v, k) => {
        logMetadata[k] = this.redactForLogging(v, metadata.classification);
      });
    }

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: ValueOps.toString(redacted),
      principal: principal.id,
      classification: metadata.classification,
      metadata: Object.keys(logMetadata).length > 0 ? logMetadata : undefined,
    };

    // Store log
    this.logs.push(entry);

    // Console output
    this.consoleLog(entry);

    return ValueFactory.ok(ValueFactory.unit());
  }

  /**
   * Redact value based on classification
   */
  private redactValue(value: Value, classification?: ClassificationLevel): Value {
    if (!classification) {
      return value;
    }

    if (classification === 'restricted' || classification === 'confidential') {
      return ValueFactory.string('[REDACTED]');
    }

    if (classification === 'internal') {
      // For internal, redact the actual value but keep the type
      return ValueFactory.string(`[${value.type.toUpperCase()}]`);
    }

    // Public - no redaction
    return value;
  }

  /**
   * Redact value for logging (converts to JS)
   */
  private redactForLogging(value: Value, classification?: ClassificationLevel): any {
    const redacted = this.redactValue(value, classification);

    // Handle records with field-level classification
    if (ValueTypeChecker.isRecord(value)) {
      const obj: any = {};
      value.fields.forEach((v, k) => {
        // Use the record's classification level if present
        const fieldClassification = value.classification || classification;
        obj[k] = this.redactForLogging(v, fieldClassification);
      });
      return obj;
    }

    if (ValueTypeChecker.isList(value)) {
      return value.value.map(v => this.redactForLogging(v, classification));
    }

    if (ValueTypeChecker.isMap(value)) {
      const obj: any = {};
      value.value.forEach((v, k) => {
        obj[k] = this.redactForLogging(v, classification);
      });
      return obj;
    }

    return ValueOps.toJS(redacted);
  }

  /**
   * Console log output
   */
  private consoleLog(entry: LogEntry): void {
    const level = entry.level.toUpperCase().padEnd(5, ' ');
    const timestamp = entry.timestamp.toISOString();
    const classification = entry.classification
      ? ` [${entry.classification.toUpperCase()}]`
      : '';
    const metadata = entry.metadata
      ? ` ${JSON.stringify(entry.metadata)}`
      : '';

    const line = `[${timestamp}] ${level}${classification} [${entry.principal}] ${entry.message}${metadata}`;

    switch (entry.level) {
      case 'debug':
        console.debug(line);
        break;
      case 'info':
        console.info(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
        console.error(line);
        break;
    }
  }

  /**
   * Get logs (for testing)
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level (for testing)
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear logs (for testing)
   */
  clearLogs(): void {
    this.logs = [];
  }
}
