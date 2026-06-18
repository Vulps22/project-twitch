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

import { AssetCacheService, isExternalUrl, extractAssetUrls, MIME_TO_EXT } from '../../backend/src/services/AssetCacheService.js';
import type { EventConfig } from '../../backend/src/types.js';

function makeConfig(reactions: EventConfig['reactions']): EventConfig {
    return { event_name: 'test', event_type: 'follow', reactions };
}

function mockResponse(mimeType: string) {
    return {
        ok: true,
        headers: { get: (h: string) => h === 'content-type' ? mimeType : null },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
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

describe('MIME_TO_EXT', () => {
    it('maps image types', () => {
        expect(MIME_TO_EXT['image/jpeg']).toBe('jpg');
        expect(MIME_TO_EXT['image/png']).toBe('png');
        expect(MIME_TO_EXT['image/gif']).toBe('gif');
    });

    it('maps audio types', () => {
        expect(MIME_TO_EXT['audio/mpeg']).toBe('mp3');
        expect(MIME_TO_EXT['audio/mp4']).toBe('m4a');
        expect(MIME_TO_EXT['audio/x-m4a']).toBe('m4a');
    });

    it('maps video types', () => {
        expect(MIME_TO_EXT['video/mp4']).toBe('mp4');
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
        expect(extractAssetUrls(configs)[0]).toEqual({ url: 'https://example.com/sound.mp3', assetType: 'sound' });
    });

    it('finds external video URLs', () => {
        const configs = [makeConfig([{ type: 'video', filename: 'https://example.com/clip.mp4' }])];
        expect(extractAssetUrls(configs)[0]).toEqual({ url: 'https://example.com/clip.mp4', assetType: 'video' });
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
    const imgUrl = 'https://example.com/img.png';
    const configs: EventConfig[] = [makeConfig([{ type: 'image', url: imgUrl }])];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new AssetCacheService();
        mockFetch.mockResolvedValue(mockResponse('image/png'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('resolve', () => {
        it('returns empty string for local filenames', () => {
            expect(service.resolve('lurk.png', 'image')).toBe('');
        });

        it('returns empty string when state is not ready', () => {
            expect(service.resolve(imgUrl, 'image')).toBe('');
        });

        it('returns cached path after successful download', async () => {
            await service.ensureReady(configs);
            const result = service.resolve(imgUrl, 'image');
            expect(result).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });

        it('returns same cached path for same URL', async () => {
            await service.ensureReady(configs);
            expect(service.resolve(imgUrl, 'image')).toBe(service.resolve(imgUrl, 'image'));
        });

        it('returns empty string when download failed for that URL', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            await service.ensureReady(configs);
            expect(service.resolve(imgUrl, 'image')).toBe('');
        });
    });

    describe('ensureReady', () => {
        it('downloads assets using MIME type from Content-Type header', async () => {
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).toHaveBeenCalled();
        });

        it('skips assets with unsupported MIME type', async () => {
            mockFetch.mockResolvedValue(mockResponse('image/bmp'));
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).not.toHaveBeenCalled();
        });

        it('skips assets with wrong MIME type for reaction type', async () => {
            const badConfigs = [makeConfig([{ type: 'image', url: imgUrl }])];
            mockFetch.mockResolvedValue(mockResponse('video/mp4'));
            await service.ensureReady(badConfigs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).not.toHaveBeenCalled();
        });

        it('skips download on second call when already ready', async () => {
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            const callCount = vi.mocked(writeFile).mock.calls.length;
            await service.ensureReady(configs);
            expect(vi.mocked(writeFile).mock.calls.length).toBe(callCount);
        });

        it('handles individual download failures gracefully', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            await expect(service.ensureReady(configs)).resolves.not.toThrow();
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
