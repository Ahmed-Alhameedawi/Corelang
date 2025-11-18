/**
 * CORE Language Diagnostics System
 * Provides rich error messages with source location and hints
 */

import { SourceLocation, SourceRange } from '../ast/types';

export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Hint = 'hint',
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  location: SourceRange;
  code?: string;
  hint?: string;
  relatedInfo?: RelatedInfo[];
}

export interface RelatedInfo {
  message: string;
  location: SourceRange;
}

export class DiagnosticBuilder {
  private diagnostics: Diagnostic[] = [];

  error(message: string, location: SourceRange, code?: string): this {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message,
      location,
      code,
    });
    return this;
  }

  warning(message: string, location: SourceRange, code?: string): this {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      message,
      location,
      code,
    });
    return this;
  }

  withHint(hint: string): this {
    if (this.diagnostics.length > 0) {
      this.diagnostics[this.diagnostics.length - 1].hint = hint;
    }
    return this;
  }

  withRelated(message: string, location: SourceRange): this {
    if (this.diagnostics.length > 0) {
      const diagnostic = this.diagnostics[this.diagnostics.length - 1];
      if (!diagnostic.relatedInfo) {
        diagnostic.relatedInfo = [];
      }
      diagnostic.relatedInfo.push({ message, location });
    }
    return this;
  }

  build(): Diagnostic[] {
    return this.diagnostics;
  }

  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === DiagnosticSeverity.Error);
  }
}

export class DiagnosticFormatter {
  constructor(private source: string) {}

  format(diagnostic: Diagnostic): string {
    const lines: string[] = [];

    // Severity and message
    const severity = this.formatSeverity(diagnostic.severity);
    lines.push(`${severity}: ${diagnostic.message}`);

    if (diagnostic.code) {
      lines[0] += ` [${diagnostic.code}]`;
    }

    // Location
    const { start, end } = diagnostic.location;
    lines.push(`  --> line ${start.line}, column ${start.column}`);

    // Source snippet
    const snippet = this.getSourceSnippet(diagnostic.location);
    if (snippet) {
      lines.push('');
      lines.push(...snippet);
    }

    // Hint
    if (diagnostic.hint) {
      lines.push('');
      lines.push(`💡 Hint: ${diagnostic.hint}`);
    }

    // Related information
    if (diagnostic.relatedInfo && diagnostic.relatedInfo.length > 0) {
      lines.push('');
      lines.push('Related:');
      for (const info of diagnostic.relatedInfo) {
        lines.push(`  ${info.message} at line ${info.location.start.line}`);
      }
    }

    return lines.join('\n');
  }

  formatAll(diagnostics: Diagnostic[]): string {
    return diagnostics.map(d => this.format(d)).join('\n\n');
  }

  private formatSeverity(severity: DiagnosticSeverity): string {
    switch (severity) {
      case DiagnosticSeverity.Error:
        return '❌ Error';
      case DiagnosticSeverity.Warning:
        return '⚠️  Warning';
      case DiagnosticSeverity.Info:
        return 'ℹ️  Info';
      case DiagnosticSeverity.Hint:
        return '💡 Hint';
    }
  }

  private getSourceSnippet(location: SourceRange): string[] | null {
    const lines = this.source.split('\n');
    const { start, end } = location;

    if (start.line < 1 || start.line > lines.length) {
      return null;
    }

    const snippetLines: string[] = [];
    const lineNumWidth = String(end.line).length;

    // Show line before (if exists)
    if (start.line > 1) {
      const prevLineNum = start.line - 1;
      snippetLines.push(
        `${String(prevLineNum).padStart(lineNumWidth)} | ${lines[prevLineNum - 1]}`
      );
    }

    // Show the error line(s)
    for (let lineNum = start.line; lineNum <= Math.min(end.line, start.line + 2); lineNum++) {
      const line = lines[lineNum - 1];
      snippetLines.push(
        `${String(lineNum).padStart(lineNumWidth)} | ${line}`
      );

      // Add caret line for single-line errors
      if (lineNum === start.line && start.line === end.line) {
        const caretLine = ' '.repeat(lineNumWidth) + ' | ' +
                         ' '.repeat(start.column - 1) +
                         '^'.repeat(Math.max(1, end.column - start.column));
        snippetLines.push(caretLine);
      }
    }

    // Show line after (if exists)
    if (end.line < lines.length) {
      const nextLineNum = Math.min(end.line + 1, lines.length);
      snippetLines.push(
        `${String(nextLineNum).padStart(lineNumWidth)} | ${lines[nextLineNum - 1]}`
      );
    }

    return snippetLines;
  }
}

/**
 * Common diagnostic messages
 */
export const DiagnosticMessages = {
  // Parser errors
  unexpectedToken: (expected: string, got: string) =>
    `Expected ${expected}, but got ${got}`,

  unexpectedEOF: () =>
    'Unexpected end of file',

  invalidVersionFormat: (version: string) =>
    `Invalid version format: ${version}`,

  // Semantic errors
  duplicateDefinition: (name: string) =>
    `Duplicate definition of '${name}'`,

  undefinedReference: (name: string) =>
    `Undefined reference to '${name}'`,

  incompatibleTypes: (expected: string, got: string) =>
    `Type mismatch: expected ${expected}, got ${got}`,

  // Versioning errors
  incompatibleVersion: (fromVersion: string, toVersion: string) =>
    `Incompatible version change from ${fromVersion} to ${toVersion}`,

  breakingChange: (what: string) =>
    `Breaking change detected: ${what}`,

  missingMigration: (fromVersion: string, toVersion: string) =>
    `Missing migration function from ${fromVersion} to ${toVersion}`,

  // Security errors
  missingPermission: (permission: string) =>
    `Missing required permission: ${permission}`,

  unauthorizedAccess: (resource: string, requiredRole: string) =>
    `Unauthorized access to ${resource}. Required role: ${requiredRole}`,

  classificationViolation: (from: string, to: string) =>
    `Data classification violation: cannot assign ${from} data to ${to} variable`,

  // Hints
  hints: {
    didYouMean: (suggestion: string) =>
      `Did you mean '${suggestion}'?`,

    checkVersion: (correctVersion: string) =>
      `Check the version format. Example: ${correctVersion}`,

    addMigration: (migrationName: string) =>
      `Consider adding a migration function: ${migrationName}`,

    checkPermissions: (role: string) =>
      `Ensure the caller has the '${role}' role`,

    useStableVersion: () =>
      `Consider using a stable version instead of beta/alpha`,
  },
};
