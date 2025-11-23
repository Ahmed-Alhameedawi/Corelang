/**
 * Database Effect Handler
 *
 * Handles database operations (read, write, transaction).
 */

import { Value, ValueFactory, ValueTypeChecker } from '../vm/value.js';
import { Principal } from '../vm/vm.js';
import { EffectHandler, EffectMetadata } from './registry.js';

/**
 * Mock database storage
 */
interface DatabaseRecord {
  [key: string]: any;
}

/**
 * Database effect handler
 */
export class DatabaseEffectHandler implements EffectHandler {
  name = 'db';

  // Mock in-memory database
  private tables: Map<string, Map<string, DatabaseRecord>> = new Map();

  /**
   * Execute database operation
   */
  async execute(
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    switch (operation) {
      case 'read':
        return this.read(params, principal);

      case 'write':
        return this.write(params, principal);

      case 'query':
        return this.query(params, principal);

      case 'execute':
        return this.executeStatement(params, principal);

      case 'transaction':
        return this.transaction(params, principal);

      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  }

  /**
   * Check permission
   */
  checkPermission(operation: string, principal: Principal): boolean {
    const requiredPerm = `db.${operation}`;

    // Simple permission check - in production, this would use the security context
    // For now, we allow all operations for principals with 'admin' or 'data.read'/'data.write' roles
    if (operation === 'read' || operation === 'query') {
      return (
        principal.roles.includes('admin') ||
        principal.roles.includes('viewer') ||
        principal.roles.includes('data.read')
      );
    }

    if (operation === 'write' || operation === 'execute' || operation === 'transaction') {
      return (
        principal.roles.includes('admin') ||
        principal.roles.includes('data.write')
      );
    }

    return false;
  }

  /**
   * Read from database
   */
  private async read(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 2) {
      return ValueFactory.err(ValueFactory.string('db.read requires table and id'));
    }

    const tableName = params[0];
    const id = params[1];

    if (!ValueTypeChecker.isString(tableName)) {
      return ValueFactory.err(ValueFactory.string('Table name must be a string'));
    }

    if (!ValueTypeChecker.isString(id)) {
      return ValueFactory.err(ValueFactory.string('ID must be a string'));
    }

    const table = this.tables.get(tableName.value);
    if (!table) {
      return ValueFactory.err(ValueFactory.string(`Table not found: ${tableName.value}`));
    }

    const record = table.get(id.value);
    if (!record) {
      return ValueFactory.err(ValueFactory.string(`Record not found: ${id.value}`));
    }

    // Convert record to CORE value
    return ValueFactory.ok(this.recordToValue(record));
  }

  /**
   * Write to database
   */
  private async write(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 3) {
      return ValueFactory.err(ValueFactory.string('db.write requires table, id, and data'));
    }

    const tableName = params[0];
    const id = params[1];
    const data = params[2];

    if (!ValueTypeChecker.isString(tableName)) {
      return ValueFactory.err(ValueFactory.string('Table name must be a string'));
    }

    if (!ValueTypeChecker.isString(id)) {
      return ValueFactory.err(ValueFactory.string('ID must be a string'));
    }

    // Get or create table
    let table = this.tables.get(tableName.value);
    if (!table) {
      table = new Map();
      this.tables.set(tableName.value, table);
    }

    // Convert CORE value to record
    const record = this.valueToRecord(data);
    table.set(id.value, record);

    return ValueFactory.ok(ValueFactory.unit());
  }

  /**
   * Query database
   */
  private async query(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('db.query requires a query string'));
    }

    const query = params[0];

    if (!ValueTypeChecker.isString(query)) {
      return ValueFactory.err(ValueFactory.string('Query must be a string'));
    }

    // Mock query execution - in production, this would parse and execute SQL
    // For now, just return empty list
    return ValueFactory.ok(ValueFactory.list([]));
  }

  /**
   * Execute database statement
   */
  private async executeStatement(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('db.execute requires a statement'));
    }

    const statement = params[0];

    if (!ValueTypeChecker.isString(statement)) {
      return ValueFactory.err(ValueFactory.string('Statement must be a string'));
    }

    // Mock execution - in production, this would execute SQL
    return ValueFactory.ok(ValueFactory.int(0)); // Rows affected
  }

  /**
   * Execute database transaction
   */
  private async transaction(params: Value[], principal: Principal): Promise<Value> {
    // Mock transaction - in production, this would use actual database transactions
    return ValueFactory.ok(ValueFactory.unit());
  }

  /**
   * Convert database record to CORE value
   */
  private recordToValue(record: DatabaseRecord): Value {
    const fields = new Map<string, Value>();

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        fields.set(key, ValueFactory.string(value));
      } else if (typeof value === 'number') {
        fields.set(key, Number.isInteger(value) ? ValueFactory.int(value) : ValueFactory.float(value));
      } else if (typeof value === 'boolean') {
        fields.set(key, ValueFactory.bool(value));
      } else {
        fields.set(key, ValueFactory.json(value));
      }
    }

    return ValueFactory.record('Record', fields);
  }

  /**
   * Convert CORE value to database record
   */
  private valueToRecord(value: Value): DatabaseRecord {
    if (ValueTypeChecker.isRecord(value)) {
      const record: DatabaseRecord = {};
      value.fields.forEach((v, k) => {
        record[k] = this.valueToJS(v);
      });
      return record;
    }

    if (ValueTypeChecker.isMap(value)) {
      const record: DatabaseRecord = {};
      value.value.forEach((v, k) => {
        record[k] = this.valueToJS(v);
      });
      return record;
    }

    return { value: this.valueToJS(value) };
  }

  /**
   * Convert CORE value to JavaScript
   */
  private valueToJS(value: Value): any {
    switch (value.type) {
      case 'unit':
        return null;
      case 'bool':
      case 'int':
      case 'float':
      case 'string':
        return value.value;
      case 'list':
        return value.value.map(v => this.valueToJS(v));
      case 'record':
        const obj: any = {};
        value.fields.forEach((v, k) => {
          obj[k] = this.valueToJS(v);
        });
        return obj;
      default:
        return null;
    }
  }

  /**
   * Get table (for testing)
   */
  getTable(name: string): Map<string, DatabaseRecord> | undefined {
    return this.tables.get(name);
  }

  /**
   * Clear all tables (for testing)
   */
  clearAll(): void {
    this.tables.clear();
  }
}
