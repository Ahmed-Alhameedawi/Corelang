/**
 * Semantic Versioning Implementation for CORE
 * Supports version parsing, comparison, and constraint matching
 */

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export enum VersionCompareResult {
  Less = -1,
  Equal = 0,
  Greater = 1,
}

/**
 * Parse a version string into a SemanticVersion object
 * Supports formats: v1, v1.2, v1.2.3, v1.2.3-beta, v1.2.3+build
 */
export function parseVersion(versionString: string): SemanticVersion | null {
  // Remove 'v' or ':v' prefix if present
  let cleaned = versionString.replace(/^:?v/, '');

  // Regular expression for semantic versioning
  const semverRegex = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
  const match = cleaned.match(semverRegex);

  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: match[2] ? parseInt(match[2], 10) : 0,
    patch: match[3] ? parseInt(match[3], 10) : 0,
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Format a SemanticVersion back to a string
 */
export function formatVersion(version: SemanticVersion): string {
  let str = `v${version.major}.${version.minor}.${version.patch}`;

  if (version.prerelease) {
    str += `-${version.prerelease}`;
  }

  if (version.build) {
    str += `+${version.build}`;
  }

  return str;
}

/**
 * Compare two semantic versions
 */
export function compareVersions(
  a: SemanticVersion,
  b: SemanticVersion
): VersionCompareResult {
  // Compare major version
  if (a.major !== b.major) {
    return a.major > b.major ? VersionCompareResult.Greater : VersionCompareResult.Less;
  }

  // Compare minor version
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? VersionCompareResult.Greater : VersionCompareResult.Less;
  }

  // Compare patch version
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? VersionCompareResult.Greater : VersionCompareResult.Less;
  }

  // Compare prerelease (versions without prerelease are greater)
  if (a.prerelease !== b.prerelease) {
    if (!a.prerelease) return VersionCompareResult.Greater;
    if (!b.prerelease) return VersionCompareResult.Less;

    // Lexicographic comparison of prerelease
    return a.prerelease > b.prerelease
      ? VersionCompareResult.Greater
      : a.prerelease < b.prerelease
      ? VersionCompareResult.Less
      : VersionCompareResult.Equal;
  }

  return VersionCompareResult.Equal;
}

/**
 * Version constraint types
 */
export type VersionConstraint =
  | { type: 'exact'; version: SemanticVersion }
  | { type: 'range'; min?: SemanticVersion | null; max?: SemanticVersion | null; minInclusive: boolean; maxInclusive: boolean }
  | { type: 'caret'; base: SemanticVersion }  // ^1.2.3 means >=1.2.3 <2.0.0
  | { type: 'tilde'; base: SemanticVersion }  // ~1.2.3 means >=1.2.3 <1.3.0
  | { type: 'latest' }
  | { type: 'stable' }
  | { type: 'any' };

/**
 * Parse a version constraint string
 */
export function parseConstraint(constraintString: string): VersionConstraint | null {
  const trimmed = constraintString.trim();

  // Latest
  if (trimmed === 'latest' || trimmed === '*') {
    return { type: 'latest' };
  }

  // Stable only
  if (trimmed === 'stable' || trimmed === 'stable-only') {
    return { type: 'stable' };
  }

  // Any
  if (trimmed === 'any' || trimmed === 'all-versions') {
    return { type: 'any' };
  }

  // Caret range (^1.2.3)
  if (trimmed.startsWith('^')) {
    const version = parseVersion(trimmed.substring(1));
    if (version) {
      return { type: 'caret', base: version };
    }
  }

  // Tilde range (~1.2.3)
  if (trimmed.startsWith('~')) {
    const version = parseVersion(trimmed.substring(1));
    if (version) {
      return { type: 'tilde', base: version };
    }
  }

  // Check for exact version first (no operators)
  if (!trimmed.match(/[<>=]/)) {
    const version = parseVersion(trimmed);
    if (version) {
      return { type: 'exact', version };
    }
  }

  // Range (>=1.0.0 <2.0.0) - only if contains operators
  const rangeMatch = trimmed.match(/^(>=?|<=?)?([v\d.]+)\s*(<|<=)?\s*([v\d.]+)?$/);
  if (rangeMatch) {
    const minOp = rangeMatch[1];
    const minVersion = parseVersion(rangeMatch[2]);
    const maxOp = rangeMatch[3];
    const maxVersion = rangeMatch[4] ? parseVersion(rangeMatch[4]) : null;

    if (minVersion) {
      return {
        type: 'range',
        min: minVersion,
        max: maxVersion,
        minInclusive: !minOp || minOp === '>=',
        maxInclusive: maxOp === '<=',
      };
    }
  }

  return null;
}

/**
 * Check if a version satisfies a constraint
 */
export function satisfiesConstraint(
  version: SemanticVersion,
  constraint: VersionConstraint
): boolean {
  switch (constraint.type) {
    case 'any':
      return true;

    case 'latest':
      return true; // Requires additional context to determine "latest"

    case 'stable':
      return !version.prerelease;

    case 'exact':
      return compareVersions(version, constraint.version) === VersionCompareResult.Equal;

    case 'caret': {
      // ^1.2.3 means >=1.2.3 <2.0.0
      const base = constraint.base;
      const upperBound: SemanticVersion = {
        major: base.major + 1,
        minor: 0,
        patch: 0,
      };

      return (
        compareVersions(version, base) >= VersionCompareResult.Equal &&
        compareVersions(version, upperBound) === VersionCompareResult.Less
      );
    }

    case 'tilde': {
      // ~1.2.3 means >=1.2.3 <1.3.0
      const base = constraint.base;
      const upperBound: SemanticVersion = {
        major: base.major,
        minor: base.minor + 1,
        patch: 0,
      };

      return (
        compareVersions(version, base) >= VersionCompareResult.Equal &&
        compareVersions(version, upperBound) === VersionCompareResult.Less
      );
    }

    case 'range': {
      if (constraint.min) {
        const minCompare = compareVersions(version, constraint.min);
        if (constraint.minInclusive) {
          if (minCompare === VersionCompareResult.Less) return false;
        } else {
          if (minCompare !== VersionCompareResult.Greater) return false;
        }
      }

      if (constraint.max) {
        const maxCompare = compareVersions(version, constraint.max);
        if (constraint.maxInclusive) {
          if (maxCompare === VersionCompareResult.Greater) return false;
        } else {
          if (maxCompare !== VersionCompareResult.Less) return false;
        }
      }

      return true;
    }

    default:
      return false;
  }
}

/**
 * Find the best matching version from a list given a constraint
 */
export function findBestMatch(
  versions: SemanticVersion[],
  constraint: VersionConstraint
): SemanticVersion | null {
  const matching = versions.filter(v => satisfiesConstraint(v, constraint));

  if (matching.length === 0) {
    return null;
  }

  // Sort in descending order and return the highest
  matching.sort((a, b) => -compareVersions(a, b));
  return matching[0];
}

/**
 * Check if a version change is a breaking change
 */
export function isBreakingChange(
  oldVersion: SemanticVersion,
  newVersion: SemanticVersion
): boolean {
  return newVersion.major > oldVersion.major;
}

/**
 * Check if versions are compatible (no major version change)
 */
export function areCompatible(
  v1: SemanticVersion,
  v2: SemanticVersion
): boolean {
  return v1.major === v2.major;
}

/**
 * Get the next version given an increment type
 */
export function incrementVersion(
  version: SemanticVersion,
  increment: 'major' | 'minor' | 'patch'
): SemanticVersion {
  switch (increment) {
    case 'major':
      return {
        major: version.major + 1,
        minor: 0,
        patch: 0,
      };
    case 'minor':
      return {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
      };
    case 'patch':
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
      };
  }
}
