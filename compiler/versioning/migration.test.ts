/**
 * Tests for Migration Function System
 */

import { MigrationRegistry, analyzeMigrationCoverage } from './migration';
import { VersionRegistry } from './registry';
import { FunctionNode, PrimitiveTypeNode } from '../ast/types';
import { parseVersion } from './semver';

// Helper to create test functions
function createFunction(
  name: string,
  version: string,
  inputTypes: string[],
  outputTypes: string[],
  pure: boolean = true,
  rollbackSafe: boolean = true
): FunctionNode {
  return {
    type: 'Function',
    name,
    version: {
      version,
      stability: 'stable',
      rollbackSafe,
    },
    signature: {
      inputs: inputTypes.map((type, i) => ({
        type: 'Parameter',
        name: `arg${i}`,
        paramType: { type: 'PrimitiveType', name: type } as PrimitiveTypeNode,
        optional: false,
      })),
      outputs: outputTypes.map((type, i) => ({
        type: 'Parameter',
        name: `result${i}`,
        paramType: { type: 'PrimitiveType', name: type } as PrimitiveTypeNode,
        optional: false,
      })),
    },
    security: {
      requiredRoles: [],
      requiredCapabilities: [],
      requiredPermissions: [],
      auditRequired: false,
      handlesSecrets: false,
      crossesBoundary: false,
    },
    effects: [],
    metadata: {
      pure,
    },
    body: { type: 'Identifier', name: 'placeholder' },
  };
}

describe('MigrationRegistry', () => {
  let migrationRegistry: MigrationRegistry;
  let versionRegistry: VersionRegistry<FunctionNode>;

  beforeEach(() => {
    migrationRegistry = new MigrationRegistry();
    versionRegistry = new VersionRegistry<FunctionNode>();
  });

  describe('registration', () => {
    it('should register a migration function', () => {
      const v1 = createFunction('multiply', 'v1.0.0', ['int', 'int'], ['int']);
      const v2 = createFunction('multiply', 'v2.0.0', ['float', 'float'], ['float']);
      const migration = createFunction('multiply_v1_to_v2', 'v1.0.0', ['int', 'int'], ['float', 'float']);

      const registered = migrationRegistry.register(
        'multiply',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      expect(registered).toBeDefined();
      expect(registered.name).toContain('multiply_v1_0_to_v2_0');
      expect(registered.fromVersion).toEqual(parseVersion('v1.0.0'));
      expect(registered.toVersion).toEqual(parseVersion('v2.0.0'));
    });

    it('should register multiple migrations for a function', () => {
      const migration1 = createFunction('m1', 'v1.0.0', ['int'], ['float']);
      const migration2 = createFunction('m2', 'v1.0.0', ['float'], ['string']);

      migrationRegistry.register('fn', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!, migration1);
      migrationRegistry.register('fn', parseVersion('v2.0.0')!, parseVersion('v3.0.0')!, migration2);

      const migrations = migrationRegistry.getAll('fn');
      expect(migrations).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('should validate a correct migration function', () => {
      const v1 = createFunction('multiply', 'v1.0.0', ['int', 'int'], ['int']);
      const v2 = createFunction('multiply', 'v2.0.0', ['float', 'float'], ['float']);
      const migration = createFunction('multiply_v1_to_v2', 'v1.0.0', ['int', 'int'], ['float', 'float']);

      versionRegistry.register(v1);
      versionRegistry.register(v2);

      const registered = migrationRegistry.register(
        'multiply',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      const isValid = migrationRegistry.validate(registered, v1, v2);

      expect(isValid).toBe(true);
      expect(registered.validated).toBe(true);
      expect(registered.issues).toHaveLength(0);
    });

    it('should reject migration with mismatched input signature', () => {
      const v1 = createFunction('multiply', 'v1.0.0', ['int', 'int'], ['int']);
      const v2 = createFunction('multiply', 'v2.0.0', ['float', 'float'], ['float']);
      const migration = createFunction('bad_migration', 'v1.0.0', ['string'], ['float', 'float']);

      const registered = migrationRegistry.register(
        'multiply',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      const isValid = migrationRegistry.validate(registered, v1, v2);

      expect(isValid).toBe(false);
      expect(registered.validated).toBe(false);
      expect(registered.issues.length).toBeGreaterThan(0);
      expect(registered.issues[0]).toContain('input signature');
    });

    it('should reject migration with mismatched output signature', () => {
      const v1 = createFunction('multiply', 'v1.0.0', ['int', 'int'], ['int']);
      const v2 = createFunction('multiply', 'v2.0.0', ['float', 'float'], ['float']);
      const migration = createFunction('bad_migration', 'v1.0.0', ['int', 'int'], ['string']);

      const registered = migrationRegistry.register(
        'multiply',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      const isValid = migrationRegistry.validate(registered, v1, v2);

      expect(isValid).toBe(false);
      expect(registered.issues[0]).toContain('output signature');
    });

    it('should reject impure migration functions', () => {
      const v1 = createFunction('fn', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('fn', 'v2.0.0', ['float'], ['float']);
      const migration = createFunction('impure_migration', 'v1.0.0', ['int'], ['float'], false);

      const registered = migrationRegistry.register(
        'fn',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      const isValid = migrationRegistry.validate(registered, v1, v2);

      expect(isValid).toBe(false);
      expect(registered.issues.some(i => i.includes('pure'))).toBe(true);
    });

    it('should reject non-rollback-safe migrations', () => {
      const v1 = createFunction('fn', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('fn', 'v2.0.0', ['float'], ['float']);
      const migration = createFunction('unsafe_migration', 'v1.0.0', ['int'], ['float'], true, false);

      const registered = migrationRegistry.register(
        'fn',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        migration
      );

      const isValid = migrationRegistry.validate(registered, v1, v2);

      expect(isValid).toBe(false);
      expect(registered.issues.some(i => i.includes('rollback-safe'))).toBe(true);
    });
  });

  describe('finding migrations', () => {
    beforeEach(() => {
      const migration = createFunction('m', 'v1.0.0', ['int'], ['float']);
      migrationRegistry.register('fn', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!, migration);
    });

    it('should find registered migration', () => {
      const found = migrationRegistry.find('fn', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!);

      expect(found).toBeDefined();
      expect(found?.fromVersion).toEqual(parseVersion('v1.0.0'));
      expect(found?.toVersion).toEqual(parseVersion('v2.0.0'));
    });

    it('should return undefined for non-existent migration', () => {
      const found = migrationRegistry.find('fn', parseVersion('v2.0.0')!, parseVersion('v3.0.0')!);

      expect(found).toBeUndefined();
    });

    it('should return undefined for non-existent function', () => {
      const found = migrationRegistry.find('other', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!);

      expect(found).toBeUndefined();
    });
  });

  describe('migration paths', () => {
    beforeEach(() => {
      // Register function versions
      const v1 = createFunction('calc', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('calc', 'v2.0.0', ['float'], ['float'], true, true);
      v2.version!.replaces = ['v1.0.0'];
      const v3 = createFunction('calc', 'v3.0.0', ['float'], ['float'], true, true);
      v3.version!.replaces = ['v2.0.0'];

      versionRegistry.register(v1);
      versionRegistry.register(v2);
      versionRegistry.register(v3);

      // Register migrations
      const m1to2 = createFunction('m1to2', 'v1.0.0', ['int'], ['float']);
      const m2to3 = createFunction('m2to3', 'v1.0.0', ['float'], ['float']);

      migrationRegistry.register('calc', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!, m1to2);
      migrationRegistry.register('calc', parseVersion('v2.0.0')!, parseVersion('v3.0.0')!, m2to3);
    });

    it('should build complete migration path', () => {
      const path = migrationRegistry.buildPath(
        'calc',
        parseVersion('v1.0.0')!,
        parseVersion('v3.0.0')!,
        versionRegistry
      );

      expect(path.isComplete).toBe(true);
      expect(path.steps).toHaveLength(2);
      expect(path.steps[0].fromVersion).toEqual(parseVersion('v1.0.0'));
      expect(path.steps[0].toVersion).toEqual(parseVersion('v2.0.0'));
      expect(path.steps[1].fromVersion).toEqual(parseVersion('v2.0.0'));
      expect(path.steps[1].toVersion).toEqual(parseVersion('v3.0.0'));
    });

    it('should detect incomplete migration path', () => {
      // Remove the second migration
      migrationRegistry.clear();
      const m1to2 = createFunction('m1to2', 'v1.0.0', ['int'], ['float']);
      migrationRegistry.register('calc', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!, m1to2);

      const path = migrationRegistry.buildPath(
        'calc',
        parseVersion('v1.0.0')!,
        parseVersion('v3.0.0')!,
        versionRegistry
      );

      expect(path.isComplete).toBe(false);
      expect(path.steps).toHaveLength(1);
    });

    it('should check if migration path exists', () => {
      expect(
        migrationRegistry.hasPath('calc', parseVersion('v1.0.0')!, parseVersion('v3.0.0')!, versionRegistry)
      ).toBe(true);
    });

    it('should return false for non-existent path', () => {
      expect(
        migrationRegistry.hasPath('calc', parseVersion('v1.0.0')!, parseVersion('v4.0.0')!, versionRegistry)
      ).toBe(false);
    });
  });

  describe('coverage analysis', () => {
    beforeEach(() => {
      // Register 3 versions
      const v1 = createFunction('fn', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('fn', 'v2.0.0', ['float'], ['float'], true, true);
      v2.version!.replaces = ['v1.0.0'];
      const v3 = createFunction('fn', 'v3.0.0', ['string'], ['string'], true, true);
      v3.version!.replaces = ['v2.0.0'];

      versionRegistry.register(v1);
      versionRegistry.register(v2);
      versionRegistry.register(v3);

      // Register only one migration
      const m1to2 = createFunction('m1to2', 'v1.0.0', ['int'], ['float']);
      const registered = migrationRegistry.register(
        'fn',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        m1to2
      );

      // Validate it
      migrationRegistry.validate(registered, v1, v2);
    });

    it('should analyze migration coverage', () => {
      const coverage = analyzeMigrationCoverage('fn', versionRegistry, migrationRegistry);

      expect(coverage.functionName).toBe('fn');
      expect(coverage.totalVersionPairs).toBe(3); // v1-v2, v1-v3, v2-v3
      expect(coverage.coveredPairs).toBe(1); // Only v1-v2
      expect(coverage.missingMigrations).toHaveLength(2);
      expect(coverage.coveragePercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      const v1 = createFunction('fn', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('fn', 'v2.0.0', ['float'], ['float']);
      const m = createFunction('m', 'v1.0.0', ['int'], ['float']);

      const registered = migrationRegistry.register('fn', parseVersion('v1.0.0')!, parseVersion('v2.0.0')!, m);
      migrationRegistry.validate(registered, v1, v2);
    });

    it('should get all migrations', () => {
      const all = migrationRegistry.getAll('fn');
      expect(all).toHaveLength(1);
    });

    it('should get validated migrations', () => {
      const validated = migrationRegistry.getValidated('fn');
      expect(validated).toHaveLength(1);
      expect(validated[0].validated).toBe(true);
    });

    it('should get invalid migrations', () => {
      const v1 = createFunction('bad', 'v1.0.0', ['int'], ['int']);
      const v2 = createFunction('bad', 'v2.0.0', ['float'], ['float']);
      const badMigration = createFunction('bad_m', 'v1.0.0', ['string'], ['int']);

      const registered = migrationRegistry.register(
        'bad',
        parseVersion('v1.0.0')!,
        parseVersion('v2.0.0')!,
        badMigration
      );
      migrationRegistry.validate(registered, v1, v2);

      const invalid = migrationRegistry.getInvalid('bad');
      expect(invalid).toHaveLength(1);
      expect(invalid[0].validated).toBe(false);
    });

    it('should clear all migrations', () => {
      migrationRegistry.clear();
      expect(migrationRegistry.getAll('fn')).toHaveLength(0);
    });
  });
});
