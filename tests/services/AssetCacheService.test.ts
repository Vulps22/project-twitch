import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { AssetCacheService, isExternalUrl, extractExtension, extractAssetUrls } from '../../backend/src/services/AssetCacheService.js';
import type { EventConfig } from '../../backend/src/types.js';

function makeConfig(reactions: EventConfig['reactions']): EventConfig {
    return { event_name: 'test', event_type: 'follow', reactions };
}

describe('isExternalUrl', () => {
    it('returns true for https URLs', () => {
        expect(isExternalUrl('https://example.com/img.png')).toBe(true);
    });

    it('returns true for http URLs', () => {
        expect(isExternalUrl('http://example.com/img.png')).toBe(true);
    });

    it('returns false for local filenames', () => {
        expect(isExternalUrl('lurk.png')).toBe(false);
    });
});

describe('extractExtension', () => {
    it('extracts extension from plain filename', () => {
        expect(extractExtension('image.png')).toBe('png');
    });

    it('extracts extension from URL ignoring query string', () => {
        expect(extractExtension('https://example.com/file.jpg?raw=1')).toBe('jpg');
    });

    it('returns null when no extension', () => {
        expect(extractExtension('noext')).toBeNull();
    });

    it('lowercases extension', () => {
        expect(extractExtension('FILE.PNG')).toBe('png');
    });
});

describe('extractAssetUrls', () => {
    it('finds external image URLs', () => {
        const configs = [makeConfig([{ type: 'image', url: 'https://example.com/img.png' }])];
        const results = extractAssetUrls(configs);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ url: 'https://example.com/img.png', assetType: 'image' });
    });

    it('finds external sound URLs', () => {
        const configs = [makeConfig([{ type: 'sound', filename: 'https://example.com/sound.mp3' }])];
        const results = extractAssetUrls(configs);
        expect(results[0]).toEqual({ url: 'https://example.com/sound.mp3', assetType: 'sound' });
    });

    it('finds external video URLs', () => {
        const configs = [makeConfig([{ type: 'video', filename: 'https://example.com/clip.mp4' }])];
        const results = extractAssetUrls(configs);
        expect(results[0]).toEqual({ url: 'https://example.com/clip.mp4', assetType: 'video' });
    });

    it('skips local filenames', () => {
        const configs = [makeConfig([{ type: 'image', url: 'local.png' }])];
        expect(extractAssetUrls(configs)).toHaveLength(0);
    });

    it('deduplicates identical URLs across configs', () => {
        const url = 'https://example.com/img.png';
        const configs = [
            makeConfig([{ type: 'image', url }]),
            makeConfig([{ type: 'image', url }]),
        ];
        expect(extractAssetUrls(configs)).toHaveLength(1);
    });
});

describe('AssetCacheService', () => {
    let service: AssetCacheService;
    const configs: EventConfig[] = [
        makeConfig([{ type: 'image', url: 'https://example.com/img.png' }]),
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new AssetCacheService();

        mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('resolve', () => {
        it('returns empty string for local filenames', () => {
            expect(service.resolve('lurk.png', 'image')).toBe('');
        });

        it('returns empty string when state is not ready', () => {
            expect(service.resolve('https://example.com/img.png', 'image')).toBe('');
        });

        it('returns cached path when state is ready', async () => {
            await service.ensureReady(configs);
            const result = service.resolve('https://example.com/img.png', 'image');
            expect(result).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });

        it('returns same cached path for same URL', async () => {
            await service.ensureReady(configs);
            const url = 'https://example.com/img.png';
            expect(service.resolve(url, 'image')).toBe(service.resolve(url, 'image'));
        });
    });

    describe('ensureReady', () => {
        it('downloads assets and sets state to ready', async () => {
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).toHaveBeenCalled();
        });

        it('skips download on second call when already ready', async () => {
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            const callCount = vi.mocked(writeFile).mock.calls.length;

            await service.ensureReady(configs);
            expect(vi.mocked(writeFile).mock.calls.length).toBe(callCount);
        });

        it('skips unsupported extensions', async () => {
            const badConfigs = [makeConfig([{ type: 'image', url: 'https://example.com/file.bmp' }])];
            await service.ensureReady(badConfigs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).not.toHaveBeenCalled();
        });

        it('still returns cached path when individual download fails (browser handles 404)', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            await service.ensureReady(configs);
            const result = service.resolve('https://example.com/img.png', 'image');
            expect(result).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });
    });

    describe('connection tracking', () => {
        it('cancels cleanup timer on reconnect', async () => {
            service.onConnect();
            service.onDisconnect();
            service.onConnect();
            await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
            const { rm } = await import('fs/promises');
            expect(rm).not.toHaveBeenCalled();
        });

        it('triggers cleanup 1 hour after all connections close', async () => {
            service.onConnect();
            service.onDisconnect();
            await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
            const { rm } = await import('fs/promises');
            expect(rm).toHaveBeenCalled();
        });

        it('does not clean up while connections remain', async () => {
            service.onConnect();
            service.onConnect();
            service.onDisconnect();
            await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
            const { rm } = await import('fs/promises');
            expect(rm).not.toHaveBeenCalled();
        });
    });
});
