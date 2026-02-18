/**
 * ProjectFormatDetector Tests -- STRUCT-004
 */

import {
  ProjectFormatDetector,
  DetectorFilesystem,
  V2_INDICATORS,
  LEGACY_INDICATORS,
  createNodeDetector
} from '../../src/editor/src/io/ProjectFormatDetector';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ---- Mock filesystem factory ------------------------------------------------

function makeMockFs(existingPaths: string[]): DetectorFilesystem {
  const set = new Set(existingPaths.map((p) => p.replace(/\\/g, '/')));
  return {
    exists: (p: string) => set.has(p.replace(/\\/g, '/')),
    join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')
  };
}

// ---- detect() ---------------------------------------------------------------

describe('ProjectFormatDetector.detect()', () => {
  it('returns v2/high when nodegx.project.json AND _registry.json exist', async () => {
    const mockFs = makeMockFs([
      '/proj/nodegx.project.json',
      '/proj/components/_registry.json',
      '/proj/components'
    ]);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('high');
  });

  it('returns v2/medium when only nodegx.project.json exists', async () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('medium');
  });

  it('returns v2/medium when only _registry.json exists', async () => {
    const mockFs = makeMockFs(['/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('medium');
  });

  it('returns legacy/high when only project.json exists', async () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('legacy');
    expect(result.confidence).toBe('high');
  });

  it('returns unknown/low when no project files exist', async () => {
    const mockFs = makeMockFs([]);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('returns v2 when both project.json and nodegx.project.json exist (mixed)', async () => {
    const mockFs = makeMockFs([
      '/proj/project.json',
      '/proj/nodegx.project.json',
      '/proj/components/_registry.json'
    ]);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('v2');
  });

  it('includes indicator for nodegx.project.json when found', async () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json', '/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.indicators.some((i) => i.includes('nodegx.project.json'))).toBe(true);
  });

  it('includes indicator for project.json when found', async () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.indicators.some((i) => i.includes('project.json'))).toBe(true);
  });

  it('includes indicator for _registry.json when found', async () => {
    const mockFs = makeMockFs(['/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.indicators.some((i) => i.includes('_registry.json'))).toBe(true);
  });

  it('includes "No project files found" indicator when nothing exists', async () => {
    const mockFs = makeMockFs([]);
    const detector = new ProjectFormatDetector(mockFs);
    const result = await detector.detect('/proj');
    expect(result.indicators.some((i) => i.toLowerCase().includes('no project files'))).toBe(true);
  });

  it('handles async filesystem.exists()', async () => {
    const asyncFs: DetectorFilesystem = {
      exists: async (p: string) => p.includes('nodegx.project.json') || p.includes('_registry.json'),
      join: (...parts: string[]) => parts.join('/')
    };
    const detector = new ProjectFormatDetector(asyncFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('high');
  });

  it('handles filesystem.exists() throwing (treats as not found)', async () => {
    const throwingFs: DetectorFilesystem = {
      exists: () => { throw new Error('permission denied'); },
      join: (...parts: string[]) => parts.join('/')
    };
    const detector = new ProjectFormatDetector(throwingFs);
    const result = await detector.detect('/proj');
    expect(result.format).toBe('unknown');
  });
});

// ---- detectSync() -----------------------------------------------------------

describe('ProjectFormatDetector.detectSync()', () => {
  it('returns v2/high for v2 project', () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json', '/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = detector.detectSync('/proj');
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('high');
  });

  it('returns legacy/high for legacy project', () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    const result = detector.detectSync('/proj');
    expect(result.format).toBe('legacy');
    expect(result.confidence).toBe('high');
  });

  it('returns unknown for empty directory', () => {
    const mockFs = makeMockFs([]);
    const detector = new ProjectFormatDetector(mockFs);
    const result = detector.detectSync('/proj');
    expect(result.format).toBe('unknown');
  });

  it('throws when filesystem.exists() returns a Promise', () => {
    const asyncFs: DetectorFilesystem = {
      exists: async () => false,
      join: (...parts: string[]) => parts.join('/')
    };
    const detector = new ProjectFormatDetector(asyncFs);
    expect(() => detector.detectSync('/proj')).toThrow('synchronous');
  });
});

// ---- getFormat() / isV2() / isLegacy() --------------------------------------

describe('ProjectFormatDetector convenience methods', () => {
  it('getFormat() returns "v2" for v2 project', async () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json', '/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.getFormat('/proj')).toBe('v2');
  });

  it('getFormat() returns "legacy" for legacy project', async () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.getFormat('/proj')).toBe('legacy');
  });

  it('getFormat() returns "unknown" for empty dir', async () => {
    const mockFs = makeMockFs([]);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.getFormat('/proj')).toBe('unknown');
  });

  it('isV2() returns true for v2 project', async () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json', '/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.isV2('/proj')).toBe(true);
  });

  it('isV2() returns false for legacy project', async () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.isV2('/proj')).toBe(false);
  });

  it('isLegacy() returns true for legacy project', async () => {
    const mockFs = makeMockFs(['/proj/project.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.isLegacy('/proj')).toBe(true);
  });

  it('isLegacy() returns false for v2 project', async () => {
    const mockFs = makeMockFs(['/proj/nodegx.project.json', '/proj/components/_registry.json']);
    const detector = new ProjectFormatDetector(mockFs);
    expect(await detector.isLegacy('/proj')).toBe(false);
  });
});

// ---- V2_INDICATORS / LEGACY_INDICATORS constants ----------------------------

describe('Sentinel constants', () => {
  it('V2_INDICATORS.projectFile is nodegx.project.json', () => {
    expect(V2_INDICATORS.projectFile).toBe('nodegx.project.json');
  });

  it('V2_INDICATORS.registryFile is components/_registry.json', () => {
    expect(V2_INDICATORS.registryFile).toBe('components/_registry.json');
  });

  it('LEGACY_INDICATORS.projectFile is project.json', () => {
    expect(LEGACY_INDICATORS.projectFile).toBe('project.json');
  });
});

// ---- createNodeDetector() integration test ----------------------------------

describe('createNodeDetector() integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-format-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects legacy project from real filesystem', async () => {
    fs.writeFileSync(path.join(tmpDir, 'project.json'), '{}');
    const detector = createNodeDetector();
    const result = await detector.detect(tmpDir);
    expect(result.format).toBe('legacy');
    expect(result.confidence).toBe('high');
  });

  it('detects v2 project from real filesystem', async () => {
    fs.writeFileSync(path.join(tmpDir, 'nodegx.project.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, 'components'));
    fs.writeFileSync(path.join(tmpDir, 'components', '_registry.json'), '{}');
    const detector = createNodeDetector();
    const result = await detector.detect(tmpDir);
    expect(result.format).toBe('v2');
    expect(result.confidence).toBe('high');
  });

  it('detects unknown for empty directory', async () => {
    const detector = createNodeDetector();
    const result = await detector.detect(tmpDir);
    expect(result.format).toBe('unknown');
  });

  it('detectSync works on real filesystem', () => {
    fs.writeFileSync(path.join(tmpDir, 'project.json'), '{}');
    const detector = createNodeDetector();
    const result = detector.detectSync(tmpDir);
    expect(result.format).toBe('legacy');
  });
});
