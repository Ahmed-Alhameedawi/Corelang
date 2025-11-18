/**
 * Tests for Version Registry
 */

import { VersionRegistry, ModuleVersionRegistry } from './registry';
import { FunctionNode } from '../ast/types';
import { parseVersion, parseConstraint } from './semver';

// Helper to create a test function node
function createTestFunction(
  name: string,
  version: string,
  stability: 'stable' | 'beta' | 'alpha' | 'deprecated' = 'stable',
  replaces?: string,
  rollbackSafe: boolean = true
): FunctionNode {
  return {
    type: 'Function',
    name,
    version: {
      version,
      stability,
      replaces: replaces ? [replaces] : undefined,
      rollbackSafe,
    },
    signature: {
      inputs: [],
      outputs: [],
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
      pure: true,
      idempotent: true,
    },
    body: { type: 'Identifier', name: 'placeholder' },
  };
}

describe('VersionRegistry', () => {
  let registry: VersionRegistry<FunctionNode>;

  beforeEach(() => {
    registry = new VersionRegistry<FunctionNode>();
  });

  describe('registration', () => {
    it('should register a function version', () => {
      const fn = createTestFunction('greet', 'v1.0.0');
      registry.register(fn);

      expect(registry.has('greet')).toBe(true);
      const version = parseVersion('v1.0.0')!;
      const entity = registry.get('greet', version);
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('greet');
      expect(entity?.version).toEqual(version);
    });

    it('should register multiple versions of the same function', () => {
      registry.register(createTestFunction('greet', 'v1.0.0'));
      registry.register(createTestFunction('greet', 'v2.0.0'));
      registry.register(createTestFunction('greet', 'v3.0.0'));

      const versions = registry.getAllVersions('greet');
      expect(versions).toHaveLength(3);
    });

    it('should throw error if function has no version', () => {
      const fn = createTestFunction('greet', 'v1.0.0');
      (fn as any).version = undefined;

      expect(() => registry.register(fn as any)).toThrow('must have a version');
    });

    it('should throw error for invalid version string', () => {
      const fn = createTestFunction('greet', 'invalid');

      expect(() => registry.register(fn)).toThrow('Invalid version string');
    });
  });

  describe('version retrieval', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0', 'deprecated'));
      registry.register(createTestFunction('greet', 'v2.0.0', 'stable'));
      registry.register(createTestFunction('greet', 'v2.1.0', 'stable'));
      registry.register(createTestFunction('greet', 'v3.0.0', 'beta'));
    });

    it('should get specific version', () => {
      const version = parseVersion('v2.0.0')!;
      const entity = registry.get('greet', version);

      expect(entity).toBeDefined();
      expect(entity?.version).toEqual(version);
      expect(entity?.stability).toBe('stable');
    });

    it('should get latest version', () => {
      const entity = registry.getLatest('greet');

      expect(entity).toBeDefined();
      expect(entity?.version).toEqual(parseVersion('v3.0.0'));
      expect(entity?.stability).toBe('beta');
    });

    it('should get latest stable version', () => {
      const entity = registry.getLatestStable('greet');

      expect(entity).toBeDefined();
      expect(entity?.version).toEqual(parseVersion('v2.1.0'));
      expect(entity?.stability).toBe('stable');
    });

    it('should return undefined for non-existent function', () => {
      const entity = registry.getLatest('nonexistent');
      expect(entity).toBeUndefined();
    });

    it('should get all versions sorted', () => {
      const versions = registry.getAllVersions('greet');

      expect(versions).toHaveLength(4);
      expect(versions[0].version).toEqual(parseVersion('v1.0.0'));
      expect(versions[1].version).toEqual(parseVersion('v2.0.0'));
      expect(versions[2].version).toEqual(parseVersion('v2.1.0'));
      expect(versions[3].version).toEqual(parseVersion('v3.0.0'));
    });
  });

  describe('constraint resolution', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0', 'stable'));
      registry.register(createTestFunction('greet', 'v1.5.0', 'stable'));
      registry.register(createTestFunction('greet', 'v2.0.0', 'stable'));
      registry.register(createTestFunction('greet', 'v2.1.0', 'stable'));
      registry.register(createTestFunction('greet', 'v3.0.0', 'beta'));
    });

    it('should resolve latest constraint', () => {
      const constraint = parseConstraint('latest')!;
      const entity = registry.resolve('greet', constraint);

      expect(entity?.version).toEqual(parseVersion('v3.0.0'));
    });

    it('should resolve stable constraint', () => {
      const constraint = parseConstraint('stable')!;
      const entity = registry.resolve('greet', constraint);

      expect(entity?.version).toEqual(parseVersion('v2.1.0'));
    });

    it('should resolve exact constraint', () => {
      const constraint = parseConstraint('v1.5.0')!;
      const entity = registry.resolve('greet', constraint);

      expect(entity?.version).toEqual(parseVersion('v1.5.0'));
    });

    it('should resolve caret constraint', () => {
      const constraint = parseConstraint('^2.0.0')!;
      const entity = registry.resolve('greet', constraint);

      // Should match highest in 2.x range
      expect(entity?.version).toEqual(parseVersion('v2.1.0'));
    });

    it('should resolve tilde constraint', () => {
      const constraint = parseConstraint('~1.0.0')!;
      const entity = registry.resolve('greet', constraint);

      // Should match only 1.0.x range
      expect(entity?.version).toEqual(parseVersion('v1.0.0'));
    });

    it('should return undefined for no matches', () => {
      const constraint = parseConstraint('v4.0.0')!;
      const entity = registry.resolve('greet', constraint);

      expect(entity).toBeUndefined();
    });
  });

  describe('replacement chains', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0', 'deprecated'));
      registry.register(createTestFunction('greet', 'v2.0.0', 'stable', 'v1.0.0'));
      registry.register(createTestFunction('greet', 'v3.0.0', 'stable', 'v2.0.0'));
    });

    it('should track replacement metadata', () => {
      const v1 = registry.get('greet', parseVersion('v1.0.0')!)!;
      const v2 = registry.get('greet', parseVersion('v2.0.0')!)!;

      expect(v1.replacedBy).toEqual(parseVersion('v2.0.0'));
      expect(v2.replaces).toEqual(parseVersion('v1.0.0'));
      expect(v2.replacedBy).toEqual(parseVersion('v3.0.0'));
    });

    it('should get replacement chain forward', () => {
      const chain = registry.getReplacementChain('greet', parseVersion('v1.0.0')!);

      expect(chain).toHaveLength(3);
      expect(chain[0]).toEqual(parseVersion('v1.0.0'));
      expect(chain[1]).toEqual(parseVersion('v2.0.0'));
      expect(chain[2]).toEqual(parseVersion('v3.0.0'));
    });

    it('should get predecessor chain backward', () => {
      const chain = registry.getPredecessorChain('greet', parseVersion('v3.0.0')!);

      expect(chain).toHaveLength(3);
      expect(chain[0]).toEqual(parseVersion('v1.0.0'));
      expect(chain[1]).toEqual(parseVersion('v2.0.0'));
      expect(chain[2]).toEqual(parseVersion('v3.0.0'));
    });

    it('should check migration path exists', () => {
      expect(
        registry.hasMigrationPath('greet', parseVersion('v1.0.0')!, parseVersion('v3.0.0')!)
      ).toBe(true);

      expect(
        registry.hasMigrationPath('greet', parseVersion('v1.0.0')!, parseVersion('v1.5.0')!)
      ).toBe(false);
    });
  });

  describe('deprecated versions', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0', 'deprecated'));
      registry.register(createTestFunction('greet', 'v2.0.0', 'stable'));

      const v2WithDeprecation = createTestFunction('greet', 'v2.1.0', 'stable');
      v2WithDeprecation.version!.deprecated = true;
      registry.register(v2WithDeprecation);
    });

    it('should identify deprecated versions', () => {
      const deprecated = registry.getDeprecated('greet');

      expect(deprecated).toHaveLength(2);
      expect(deprecated.map(d => d.version.major + '.' + d.version.minor)).toContain('1.0');
      expect(deprecated.map(d => d.version.major + '.' + d.version.minor)).toContain('2.1');
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0', 'deprecated'));
      registry.register(createTestFunction('greet', 'v2.0.0', 'stable'));
      registry.register(createTestFunction('greet', 'v2.1.0', 'stable'));
      registry.register(createTestFunction('greet', 'v3.0.0', 'beta'));
      registry.register(createTestFunction('greet', 'v4.0.0', 'alpha'));
    });

    it('should generate version statistics', () => {
      const stats = registry.getStats('greet');

      expect(stats).toBeDefined();
      expect(stats?.totalVersions).toBe(5);
      expect(stats?.stableVersions).toBe(2);
      expect(stats?.deprecatedVersions).toBe(1);
      expect(stats?.betaVersions).toBe(1);
      expect(stats?.alphaVersions).toBe(1);
      expect(stats?.latestVersion).toEqual(parseVersion('v4.0.0'));
      expect(stats?.latestStableVersion).toEqual(parseVersion('v2.1.0'));
    });

    it('should return undefined stats for non-existent function', () => {
      const stats = registry.getStats('nonexistent');
      expect(stats).toBeUndefined();
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      registry.register(createTestFunction('greet', 'v1.0.0'));
      registry.register(createTestFunction('hello', 'v1.0.0'));
    });

    it('should get all entity names', () => {
      const names = registry.getAllNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('greet');
      expect(names).toContain('hello');
    });

    it('should check entity existence', () => {
      expect(registry.has('greet')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should clear registry', () => {
      registry.clear();

      expect(registry.has('greet')).toBe(false);
      expect(registry.has('hello')).toBe(false);
      expect(registry.getAllNames()).toHaveLength(0);
    });
  });
});

describe('ModuleVersionRegistry', () => {
  let moduleRegistry: ModuleVersionRegistry;

  beforeEach(() => {
    moduleRegistry = new ModuleVersionRegistry();
  });

  it('should register functions and types from module', () => {
    const module = {
      functions: [
        createTestFunction('greet', 'v1.0.0'),
        createTestFunction('greet', 'v2.0.0'),
        createTestFunction('hello', 'v1.0.0'),
      ],
    };

    moduleRegistry.registerModule(module);

    expect(moduleRegistry.functions.has('greet')).toBe(true);
    expect(moduleRegistry.functions.has('hello')).toBe(true);
    expect(moduleRegistry.functions.getAllVersions('greet')).toHaveLength(2);
  });

  it('should get overall statistics', () => {
    const module = {
      functions: [
        createTestFunction('greet', 'v1.0.0'),
        createTestFunction('greet', 'v2.0.0'),
        createTestFunction('hello', 'v1.0.0'),
      ],
    };

    moduleRegistry.registerModule(module);
    const stats = moduleRegistry.getOverallStats();

    expect(stats.functions.size).toBe(2);
    expect(stats.functions.get('greet')?.totalVersions).toBe(2);
    expect(stats.functions.get('hello')?.totalVersions).toBe(1);
  });

  it('should clear all registries', () => {
    const module = {
      functions: [createTestFunction('greet', 'v1.0.0')],
    };

    moduleRegistry.registerModule(module);
    moduleRegistry.clear();

    expect(moduleRegistry.functions.has('greet')).toBe(false);
  });
});
