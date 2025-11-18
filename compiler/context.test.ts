/**
 * Tests for Compiler Context
 */

import { CompilerContext } from './context';
import { ModuleNode, FunctionNode } from './ast/types';

// Helper to create a minimal module
function createModule(name: string, functions: FunctionNode[]): ModuleNode {
  return {
    type: 'Module',
    name,
    version: '1.0.0',
    metadata: {},
    elements: functions,
  };
}

// Helper to create a test function
function createFunction(
  name: string,
  version: string,
  stability: 'stable' | 'beta' | 'alpha' | 'deprecated' = 'stable',
  replaces?: string
): FunctionNode {
  return {
    type: 'Function',
    name,
    version: {
      version,
      stability,
      replaces: replaces ? [replaces] : undefined,
      rollbackSafe: true,
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
    },
    body: { type: 'Identifier', name: 'placeholder' },
  };
}

describe('CompilerContext', () => {
  let context: CompilerContext;

  beforeEach(() => {
    context = new CompilerContext();
  });

  describe('module registration', () => {
    it('should register a module with functions', () => {
      const fn = createFunction('greet', 'v1.0.0');
      const module = createModule('test', [fn]);

      context.registerModule(module);

      expect(context.getModule('test')).toBe(module);
      expect(context.versionRegistry.functions.has('greet')).toBe(true);
    });

    it('should register multiple modules', () => {
      const mod1 = createModule('mod1', [createFunction('fn1', 'v1.0.0')]);
      const mod2 = createModule('mod2', [createFunction('fn2', 'v1.0.0')]);

      context.registerModule(mod1);
      context.registerModule(mod2);

      expect(context.getAllModules()).toHaveLength(2);
    });
  });

  describe('version validation', () => {
    it('should detect invalid version strings', () => {
      const fn = createFunction('bad', 'invalid-version');
      const module = createModule('test', [fn]);

      context.registerModule(module);

      expect(context.hasErrors()).toBe(true);
      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER001')).toBe(true);
    });

    it('should warn on deprecated functions', () => {
      const fn = createFunction('old', 'v1.0.0', 'deprecated');
      const module = createModule('test', [fn]);

      context.registerModule(module);

      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER005')).toBe(true);
    });

    it('should warn on unstable versions', () => {
      const fn = createFunction('experimental', 'v0.1.0', 'alpha');
      const module = createModule('test', [fn]);

      context.registerModule(module);

      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER006')).toBe(true);
    });

    it('should allow unstable versions with option', () => {
      context = new CompilerContext({ allowUnstableVersions: true });

      const fn = createFunction('experimental', 'v0.1.0', 'alpha');
      const module = createModule('test', [fn]);

      context.registerModule(module);

      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER006')).toBe(false);
    });
  });

  describe('breaking change detection', () => {
    it('should detect breaking changes without major version bump', () => {
      const v1 = createFunction('fn', 'v1.0.0');
      v1.signature.inputs = [{
        type: 'Parameter',
        name: 'x',
        paramType: { type: 'PrimitiveType', name: 'int' },
        optional: false,
      }];

      const v2 = createFunction('fn', 'v1.1.0', 'stable', 'v1.0.0');
      v2.signature.inputs = [{
        type: 'Parameter',
        name: 'x',
        paramType: { type: 'PrimitiveType', name: 'string' },
        optional: false,
      }];

      const module1 = createModule('test', [v1]);
      const module2 = createModule('test', [v2]);

      context.registerModule(module1);
      context.registerModule(module2);

      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER003')).toBe(true);
    });
  });

  describe('version resolution', () => {
    beforeEach(() => {
      const v1 = createFunction('calc', 'v1.0.0');
      const v2 = createFunction('calc', 'v2.0.0');
      const v3 = createFunction('calc', 'v3.0.0');

      const module = createModule('test', [v1, v2, v3]);
      context.registerModule(module);
    });

    it('should resolve exact version constraint', () => {
      const resolved = context.resolveFunctionVersion('calc', 'v2.0.0');

      expect(resolved).toBeDefined();
      expect(resolved?.version?.version).toBe('v2.0.0');
    });

    it('should resolve caret constraint', () => {
      const resolved = context.resolveFunctionVersion('calc', '^2.0.0');

      expect(resolved).toBeDefined();
      expect(resolved?.version?.version).toBe('v2.0.0');
    });

    it('should resolve latest constraint', () => {
      const resolved = context.resolveFunctionVersion('calc', 'latest');

      expect(resolved).toBeDefined();
      expect(resolved?.version?.version).toBe('v3.0.0');
    });

    it('should error on invalid constraint', () => {
      const resolved = context.resolveFunctionVersion('calc', 'bad-constraint');

      expect(resolved).toBeUndefined();
      expect(context.hasErrors()).toBe(true);
      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER008')).toBe(true);
    });

    it('should error on unsatisfiable constraint', () => {
      const resolved = context.resolveFunctionVersion('calc', 'v4.0.0');

      expect(resolved).toBeUndefined();
      expect(context.hasErrors()).toBe(true);
      const diagnostics = context.getDiagnostics();
      expect(diagnostics.some(d => d.code === 'VER009')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should provide version statistics', () => {
      const v1 = createFunction('fn', 'v1.0.0', 'deprecated');
      const v2 = createFunction('fn', 'v2.0.0', 'stable');
      const v3 = createFunction('fn', 'v3.0.0', 'beta');

      const module = createModule('test', [v1, v2, v3]);
      context.registerModule(module);

      const stats = context.getVersionStats();

      expect(stats.functions.size).toBe(1);
      const fnStats = stats.functions.get('fn');
      expect(fnStats?.totalVersions).toBe(3);
      expect(fnStats?.stableVersions).toBe(1);
      expect(fnStats?.deprecatedVersions).toBe(1);
      expect(fnStats?.betaVersions).toBe(1);
    });
  });

  describe('context reset', () => {
    it('should clear all state on reset', () => {
      const fn = createFunction('fn', 'v1.0.0');
      const module = createModule('test', [fn]);

      context.registerModule(module);
      expect(context.getAllModules()).toHaveLength(1);

      context.reset();

      expect(context.getAllModules()).toHaveLength(0);
      expect(context.versionRegistry.functions.has('fn')).toBe(false);
      expect(context.hasErrors()).toBe(false);
    });
  });
});
