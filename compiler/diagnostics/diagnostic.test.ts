/**
 * Tests for Diagnostic System
 */

import { DiagnosticBuilder, DiagnosticFormatter, DiagnosticMessages, DiagnosticSeverity } from './diagnostic';
import { createSourceLocation, createSourceRange } from '../ast/types';

describe('Diagnostic System', () => {
  describe('DiagnosticBuilder', () => {
    test('should build error diagnostic', () => {
      const builder = new DiagnosticBuilder();
      const location = createSourceRange(
        createSourceLocation(1, 5, 4),
        createSourceLocation(1, 10, 9)
      );

      const diagnostics = builder
        .error('Test error', location, 'E001')
        .withHint('This is a hint')
        .build();

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toBe('Test error');
      expect(diagnostics[0].code).toBe('E001');
      expect(diagnostics[0].hint).toBe('This is a hint');
    });

    test('should build multiple diagnostics', () => {
      const builder = new DiagnosticBuilder();
      const loc1 = createSourceRange(
        createSourceLocation(1, 1, 0),
        createSourceLocation(1, 5, 4)
      );
      const loc2 = createSourceRange(
        createSourceLocation(2, 1, 10),
        createSourceLocation(2, 5, 14)
      );

      const diagnostics = builder
        .error('First error', loc1)
        .warning('First warning', loc2)
        .build();

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[1].severity).toBe(DiagnosticSeverity.Warning);
    });

    test('should detect errors', () => {
      const builder = new DiagnosticBuilder();
      const location = createSourceRange(
        createSourceLocation(1, 1, 0),
        createSourceLocation(1, 5, 4)
      );

      builder.warning('Just a warning', location);
      expect(builder.hasErrors()).toBe(false);

      builder.error('An error', location);
      expect(builder.hasErrors()).toBe(true);
    });
  });

  describe('DiagnosticFormatter', () => {
    const source = `(mod test
  (fn hello :v1
    :inputs [(name :string)]
    (body "Hello")))`;

    test('should format error with source snippet', () => {
      const formatter = new DiagnosticFormatter(source);
      const location = createSourceRange(
        createSourceLocation(2, 13, 25),
        createSourceLocation(2, 15, 27)
      );

      const diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Invalid version marker',
        location,
        code: 'E001',
        hint: 'Version should be in format :v1, :v2, etc.',
      };

      const formatted = formatter.format(diagnostic);

      expect(formatted).toContain('❌ Error: Invalid version marker');
      expect(formatted).toContain('[E001]');
      expect(formatted).toContain('line 2, column 13');
      expect(formatted).toContain('(fn hello :v1');
      expect(formatted).toContain('💡 Hint:');
    });

    test('should format multiple diagnostics', () => {
      const formatter = new DiagnosticFormatter(source);
      const loc1 = createSourceRange(
        createSourceLocation(1, 1, 0),
        createSourceLocation(1, 4, 3)
      );
      const loc2 = createSourceRange(
        createSourceLocation(2, 1, 10),
        createSourceLocation(2, 3, 12)
      );

      const diagnostics = [
        {
          severity: DiagnosticSeverity.Error,
          message: 'First error',
          location: loc1,
        },
        {
          severity: DiagnosticSeverity.Warning,
          message: 'Second warning',
          location: loc2,
        },
      ];

      const formatted = formatter.formatAll(diagnostics);

      expect(formatted).toContain('❌ Error: First error');
      expect(formatted).toContain('⚠️  Warning: Second warning');
    });
  });

  describe('DiagnosticMessages', () => {
    test('should generate parser error messages', () => {
      expect(DiagnosticMessages.unexpectedToken('RPAREN', 'IDENTIFIER'))
        .toBe('Expected RPAREN, but got IDENTIFIER');

      expect(DiagnosticMessages.unexpectedEOF())
        .toBe('Unexpected end of file');
    });

    test('should generate versioning error messages', () => {
      expect(DiagnosticMessages.incompatibleVersion('v1', 'v2'))
        .toContain('Incompatible version change');

      expect(DiagnosticMessages.breakingChange('Input type changed'))
        .toContain('Breaking change detected');
    });

    test('should generate security error messages', () => {
      expect(DiagnosticMessages.missingPermission('user.write'))
        .toContain('Missing required permission: user.write');

      expect(DiagnosticMessages.unauthorizedAccess('database', 'admin'))
        .toContain('Required role: admin');
    });

    test('should generate helpful hints', () => {
      expect(DiagnosticMessages.hints.didYouMean('hello'))
        .toBe("Did you mean 'hello'?");

      expect(DiagnosticMessages.hints.checkVersion(':v1'))
        .toContain('Example: :v1');
    });
  });
});
