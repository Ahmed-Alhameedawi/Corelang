/**
 * Filesystem Effect Handler
 *
 * Handles filesystem operations (read, write, list).
 */

import { Value, ValueFactory, ValueTypeChecker } from '../vm/value.js';
import { Principal } from '../vm/vm.js';
import { EffectHandler, EffectMetadata } from './registry.js';

/**
 * Filesystem effect handler
 */
export class FilesystemEffectHandler implements EffectHandler {
  name = 'fs';

  // Mock in-memory filesystem
  private files: Map<string, string> = new Map();

  /**
   * Execute filesystem operation
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

      case 'list':
        return this.list(params, principal);

      case 'exists':
        return this.exists(params, principal);

      case 'delete':
        return this.delete(params, principal);

      default:
        throw new Error(`Unknown filesystem operation: ${operation}`);
    }
  }

  /**
   * Check permission
   */
  checkPermission(operation: string, principal: Principal): boolean {
    if (operation === 'read' || operation === 'list' || operation === 'exists') {
      return (
        principal.roles.includes('admin') ||
        principal.roles.includes('fs.read') ||
        principal.roles.includes('viewer')
      );
    }

    if (operation === 'write' || operation === 'delete') {
      return (
        principal.roles.includes('admin') ||
        principal.roles.includes('fs.write')
      );
    }

    return false;
  }

  /**
   * Read file
   */
  private async read(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('fs.read requires a path'));
    }

    const path = params[0];

    if (!ValueTypeChecker.isString(path)) {
      return ValueFactory.err(ValueFactory.string('Path must be a string'));
    }

    // Mock file read
    const content = this.files.get(path.value);
    if (content === undefined) {
      return ValueFactory.err(ValueFactory.string(`File not found: ${path.value}`));
    }

    return ValueFactory.ok(ValueFactory.string(content));
  }

  /**
   * Write file
   */
  private async write(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 2) {
      return ValueFactory.err(ValueFactory.string('fs.write requires path and content'));
    }

    const path = params[0];
    const content = params[1];

    if (!ValueTypeChecker.isString(path)) {
      return ValueFactory.err(ValueFactory.string('Path must be a string'));
    }

    if (!ValueTypeChecker.isString(content)) {
      return ValueFactory.err(ValueFactory.string('Content must be a string'));
    }

    // Mock file write
    this.files.set(path.value, content.value);

    return ValueFactory.ok(ValueFactory.unit());
  }

  /**
   * List directory
   */
  private async list(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('fs.list requires a directory path'));
    }

    const dir = params[0];

    if (!ValueTypeChecker.isString(dir)) {
      return ValueFactory.err(ValueFactory.string('Directory path must be a string'));
    }

    // Mock directory listing
    const entries: Value[] = [];
    const prefix = dir.value === '/' ? '' : dir.value + '/';

    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        const relativePath = path.substring(prefix.length);
        if (!relativePath.includes('/')) {
          entries.push(ValueFactory.string(relativePath));
        }
      }
    }

    return ValueFactory.ok(ValueFactory.list(entries));
  }

  /**
   * Check if file exists
   */
  private async exists(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('fs.exists requires a path'));
    }

    const path = params[0];

    if (!ValueTypeChecker.isString(path)) {
      return ValueFactory.err(ValueFactory.string('Path must be a string'));
    }

    const exists = this.files.has(path.value);
    return ValueFactory.ok(ValueFactory.bool(exists));
  }

  /**
   * Delete file
   */
  private async delete(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('fs.delete requires a path'));
    }

    const path = params[0];

    if (!ValueTypeChecker.isString(path)) {
      return ValueFactory.err(ValueFactory.string('Path must be a string'));
    }

    const deleted = this.files.delete(path.value);

    if (!deleted) {
      return ValueFactory.err(ValueFactory.string(`File not found: ${path.value}`));
    }

    return ValueFactory.ok(ValueFactory.unit());
  }

  /**
   * Get file (for testing)
   */
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  /**
   * Clear all files (for testing)
   */
  clearAll(): void {
    this.files.clear();
  }
}
