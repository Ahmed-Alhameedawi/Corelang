/**
 * Tests for Semantic Versioning System
 */

import {
  parseVersion,
  formatVersion,
  compareVersions,
  VersionCompareResult,
  parseConstraint,
  satisfiesConstraint,
  findBestMatch,
  isBreakingChange,
  areCompatible,
  incrementVersion,
} from './semver';

describe('Semantic Versioning', () => {
  describe('parseVersion', () => {
    test('should parse simple version', () => {
      const v = parseVersion('v1');
      expect(v).toEqual({ major: 1, minor: 0, patch: 0 });
    });

    test('should parse version with minor', () => {
      const v = parseVersion('v1.2');
      expect(v).toEqual({ major: 1, minor: 2, patch: 0 });
    });

    test('should parse full semantic version', () => {
      const v = parseVersion('v1.2.3');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('should parse version with prerelease', () => {
      const v = parseVersion('v1.2.3-beta.1');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'beta.1' });
    });

    test('should parse version with build metadata', () => {
      const v = parseVersion('v1.2.3+build.123');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3, build: 'build.123' });
    });

    test('should parse version with both prerelease and build', () => {
      const v = parseVersion('v1.2.3-alpha+build');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'alpha', build: 'build' });
    });

    test('should parse version with :v prefix', () => {
      const v = parseVersion(':v2.1.0');
      expect(v).toEqual({ major: 2, minor: 1, patch: 0 });
    });

    test('should return null for invalid version', () => {
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('v.1.2')).toBeNull();
      expect(parseVersion('')).toBeNull();
    });
  });

  describe('formatVersion', () => {
    test('should format basic version', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('v1.2.3');
    });

    test('should format version with prerelease', () => {
      expect(formatVersion({ major: 1, minor: 0, patch: 0, prerelease: 'beta' }))
        .toBe('v1.0.0-beta');
    });

    test('should format version with build', () => {
      expect(formatVersion({ major: 2, minor: 1, patch: 0, build: '20250117' }))
        .toBe('v2.1.0+20250117');
    });
  });

  describe('compareVersions', () => {
    test('should compare equal versions', () => {
      const v1 = parseVersion('v1.2.3')!;
      const v2 = parseVersion('v1.2.3')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Equal);
    });

    test('should compare different major versions', () => {
      const v1 = parseVersion('v1.2.3')!;
      const v2 = parseVersion('v2.2.3')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Less);
      expect(compareVersions(v2, v1)).toBe(VersionCompareResult.Greater);
    });

    test('should compare different minor versions', () => {
      const v1 = parseVersion('v1.2.3')!;
      const v2 = parseVersion('v1.3.3')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Less);
      expect(compareVersions(v2, v1)).toBe(VersionCompareResult.Greater);
    });

    test('should compare different patch versions', () => {
      const v1 = parseVersion('v1.2.3')!;
      const v2 = parseVersion('v1.2.4')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Less);
      expect(compareVersions(v2, v1)).toBe(VersionCompareResult.Greater);
    });

    test('should consider versions without prerelease greater than with', () => {
      const v1 = parseVersion('v1.0.0-beta')!;
      const v2 = parseVersion('v1.0.0')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Less);
      expect(compareVersions(v2, v1)).toBe(VersionCompareResult.Greater);
    });

    test('should compare prerelease versions lexicographically', () => {
      const v1 = parseVersion('v1.0.0-alpha')!;
      const v2 = parseVersion('v1.0.0-beta')!;
      expect(compareVersions(v1, v2)).toBe(VersionCompareResult.Less);
    });
  });

  describe('parseConstraint', () => {
    test('should parse exact version constraint', () => {
      const constraint = parseConstraint('v1.2.3');
      expect(constraint).toEqual({
        type: 'exact',
        version: { major: 1, minor: 2, patch: 3 },
      });
    });

    test('should parse caret constraint', () => {
      const constraint = parseConstraint('^v1.2.3');
      expect(constraint?.type).toBe('caret');
      expect((constraint as any).base).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('should parse tilde constraint', () => {
      const constraint = parseConstraint('~v1.2.3');
      expect(constraint?.type).toBe('tilde');
      expect((constraint as any).base).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('should parse latest constraint', () => {
      expect(parseConstraint('latest')).toEqual({ type: 'latest' });
      expect(parseConstraint('*')).toEqual({ type: 'latest' });
    });

    test('should parse stable constraint', () => {
      expect(parseConstraint('stable')).toEqual({ type: 'stable' });
      expect(parseConstraint('stable-only')).toEqual({ type: 'stable' });
    });

    test('should parse any constraint', () => {
      expect(parseConstraint('any')).toEqual({ type: 'any' });
      expect(parseConstraint('all-versions')).toEqual({ type: 'any' });
    });
  });

  describe('satisfiesConstraint', () => {
    test('should satisfy exact version', () => {
      const version = parseVersion('v1.2.3')!;
      const constraint = parseConstraint('v1.2.3')!;
      expect(satisfiesConstraint(version, constraint)).toBe(true);

      const different = parseVersion('v1.2.4')!;
      expect(satisfiesConstraint(different, constraint)).toBe(false);
    });

    test('should satisfy caret constraint', () => {
      const constraint = parseConstraint('^v1.2.3')!;

      expect(satisfiesConstraint(parseVersion('v1.2.3')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v1.2.5')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v1.3.0')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v2.0.0')!, constraint)).toBe(false);
      expect(satisfiesConstraint(parseVersion('v1.2.2')!, constraint)).toBe(false);
    });

    test('should satisfy tilde constraint', () => {
      const constraint = parseConstraint('~v1.2.3')!;

      expect(satisfiesConstraint(parseVersion('v1.2.3')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v1.2.5')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v1.3.0')!, constraint)).toBe(false);
      expect(satisfiesConstraint(parseVersion('v1.2.2')!, constraint)).toBe(false);
    });

    test('should satisfy stable constraint', () => {
      const constraint = parseConstraint('stable')!;

      expect(satisfiesConstraint(parseVersion('v1.2.3')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v1.2.3-beta')!, constraint)).toBe(false);
    });

    test('should satisfy any constraint', () => {
      const constraint = parseConstraint('any')!;

      expect(satisfiesConstraint(parseVersion('v1.2.3')!, constraint)).toBe(true);
      expect(satisfiesConstraint(parseVersion('v2.0.0-alpha')!, constraint)).toBe(true);
    });
  });

  describe('findBestMatch', () => {
    const versions = [
      parseVersion('v1.0.0')!,
      parseVersion('v1.1.0')!,
      parseVersion('v1.2.0')!,
      parseVersion('v2.0.0')!,
      parseVersion('v2.1.0-beta')!,
    ];

    test('should find best match for caret constraint', () => {
      const constraint = parseConstraint('^v1.0.0')!;
      const best = findBestMatch(versions, constraint);

      expect(best).toEqual({ major: 1, minor: 2, patch: 0 });
    });

    test('should find best match for stable constraint', () => {
      const constraint = parseConstraint('stable')!;
      const best = findBestMatch(versions, constraint);

      expect(best).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    test('should return null if no match', () => {
      const constraint = parseConstraint('^v3.0.0')!;
      const best = findBestMatch(versions, constraint);

      expect(best).toBeNull();
    });
  });

  describe('isBreakingChange', () => {
    test('should detect breaking change', () => {
      const old = parseVersion('v1.2.3')!;
      const breaking = parseVersion('v2.0.0')!;
      const nonBreaking = parseVersion('v1.3.0')!;

      expect(isBreakingChange(old, breaking)).toBe(true);
      expect(isBreakingChange(old, nonBreaking)).toBe(false);
    });
  });

  describe('areCompatible', () => {
    test('should check version compatibility', () => {
      const v1 = parseVersion('v1.2.3')!;
      const v2 = parseVersion('v1.5.0')!;
      const v3 = parseVersion('v2.0.0')!;

      expect(areCompatible(v1, v2)).toBe(true);
      expect(areCompatible(v1, v3)).toBe(false);
    });
  });

  describe('incrementVersion', () => {
    const base = parseVersion('v1.2.3')!;

    test('should increment major version', () => {
      const next = incrementVersion(base, 'major');
      expect(next).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    test('should increment minor version', () => {
      const next = incrementVersion(base, 'minor');
      expect(next).toEqual({ major: 1, minor: 3, patch: 0 });
    });

    test('should increment patch version', () => {
      const next = incrementVersion(base, 'patch');
      expect(next).toEqual({ major: 1, minor: 2, patch: 4 });
    });
  });
});
