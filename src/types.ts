// Mirrors @sheplu/dependency-guard's AnalysisReport JSON shape.
// Must track upstream: ../dependency-guard/src (search for AnalysisReport).
export type UpdateType = 'up-to-date' | 'patch' | 'minor' | 'major';

export type DependencyType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'
  | 'overrides'
  | 'resolutions'
  | 'pnpm.overrides';

export interface VersionInfo {
  version: string;
  publishedAt: string | null;
}

export interface AnalysisDependency {
  name: string;
  type: DependencyType;
  current: VersionInfo;
  latestPatch: VersionInfo | null;
  latestMinor: VersionInfo | null;
  latestMajor: VersionInfo | null;
  ageInDays: number | null;
  latestAgeInDays: number | null;
  updateType: UpdateType;
  deprecated: string | null;
  transitive: boolean;
}

export interface SkippedDependency {
  name: string;
  type: DependencyType;
  reason: string;
  scope?: string;
  status?: number;
}

export interface AnalysisSummary {
  total: number;
  upToDate: number;
  patchUpdates: number;
  minorUpdates: number;
  majorUpdates: number;
  deprecated?: number;
}

export interface AnalysisReport {
  summary: AnalysisSummary;
  dependencies: AnalysisDependency[];
  skipped: SkippedDependency[];
}
