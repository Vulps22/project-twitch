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

import { AssetCacheService, isExternalUrl, extractAssetUrls, MIME_TO_EXT, resolveAssetMime } from '../../backend/src/services/AssetCacheService.js';
import type { EventConfig } from '../../backend/src/types.js';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);

function makeConfig(reactions: EventConfig['reactions']): EventConfig {
    return { event_name: 'test', event_type: 'follow', reactions };
}

function mockResponse(mimeType: string, url = '', bytes: Uint8Array = new Uint8Array(8)) {
    return {
        ok: true,
        url,
        headers: { get: (h: string) => h === 'content-type' ? mimeType : null },
        arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
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

describe('resolveAssetMime', () => {
    const b = (bytes: Uint8Array) => Buffer.from(bytes);

    it('trusts a known, specific Content-Type header', () => {
        expect(resolveAssetMime('image/png', b(new Uint8Array(8)), 'https://x/y.bin')).toBe('image/png');
    });

    it('rejects a specific but unsupported Content-Type without falling back', () => {
        expect(resolveAssetMime('image/bmp', b(PNG_BYTES), 'https://x/y.png')).toBeUndefined();
    });

    it('sniffs PNG magic bytes when the header is generic', () => {
        expect(resolveAssetMime('application/binary', b(PNG_BYTES), 'https://x/file')).toBe('image/png');
    });

    it('sniffs JPEG and GIF magic bytes', () => {
        expect(resolveAssetMime('application/octet-stream', b(JPEG_BYTES), 'https://x/file')).toBe('image/jpeg');
        expect(resolveAssetMime('', b(GIF_BYTES), 'https://x/file')).toBe('image/gif');
    });

    it('falls back to the URL extension when bytes are unrecognized', () => {
        expect(resolveAssetMime('application/binary', b(new Uint8Array(8)), 'https://www.dropbox.com/s/abc/lurk.png?dl=1')).toBe('image/png');
        expect(resolveAssetMime('application/binary', b(new Uint8Array(8)), 'https://x/clip.mp4')).toBe('video/mp4');
    });

    it('returns undefined when generic with no usable bytes or extension', () => {
        expect(resolveAssetMime('application/binary', b(new Uint8Array(8)), 'https://x/file')).toBeUndefined();
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

    describe('invalidate', () => {
        it('resets state so ensureReady re-downloads on next call', async () => {
            await service.ensureReady(configs);
            service.invalidate();
            vi.clearAllMocks();
            await service.ensureReady(configs);
            const { writeFile } = await import('fs/promises');
            expect(writeFile).toHaveBeenCalled();
        });

        it('clears resolve results after invalidation', async () => {
            await service.ensureReady(configs);
            expect(service.resolve(imgUrl, 'image')).not.toBe('');
            service.invalidate();
            expect(service.resolve(imgUrl, 'image')).toBe('');
        });
    });

    describe('previewUrl', () => {
        it('downloads and returns a cached path', async () => {
            const path = await service.previewUrl(imgUrl, 'image');
            expect(path).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });

        it('returns existing cached path without re-downloading', async () => {
            await service.previewUrl(imgUrl, 'image');
            const { writeFile } = await import('fs/promises');
            const callsBefore = vi.mocked(writeFile).mock.calls.length;
            await service.previewUrl(imgUrl, 'image');
            expect(vi.mocked(writeFile).mock.calls.length).toBe(callsBefore);
        });

        it('throws for a local filename', async () => {
            await expect(service.previewUrl('local.png', 'image')).rejects.toThrow('Must be an external URL');
        });

        it('throws for unsupported MIME type', async () => {
            mockFetch.mockResolvedValue(mockResponse('image/bmp'));
            await expect(service.previewUrl(imgUrl, 'image')).rejects.toThrow('Unsupported content type');
        });

        it('throws when MIME type does not match asset type', async () => {
            mockFetch.mockResolvedValue(mockResponse('video/mp4'));
            await expect(service.previewUrl(imgUrl, 'image')).rejects.toThrow('not valid for image');
        });

        it('caches a generic application/binary response by sniffing magic bytes', async () => {
            mockFetch.mockResolvedValue(mockResponse('application/binary', '', PNG_BYTES));
            const path = await service.previewUrl(imgUrl, 'image');
            expect(path).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });

        it('caches a generic response by URL extension when bytes are unrecognized', async () => {
            const dropboxUrl = 'https://www.dropbox.com/scl/fi/abc/lurk.png?dl=1';
            mockFetch.mockResolvedValue(mockResponse('application/binary', '', new Uint8Array(8)));
            const path = await service.previewUrl(dropboxUrl, 'image');
            expect(path).toMatch(/^\/cache\/[a-f0-9]+\/img\/[a-f0-9]+\.png$/);
        });

        it('throws on HTTP error', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 404, url: '', headers: { get: () => null }, arrayBuffer: vi.fn() });
            await expect(service.previewUrl(imgUrl, 'image')).rejects.toThrow('HTTP 404');
        });

        it('throws a clear message when Google redirects to sign-in', async () => {
            mockFetch.mockResolvedValue({ ...mockResponse('text/html'), url: 'https://accounts.google.com/ServiceLogin' });
            await expect(service.previewUrl(imgUrl, 'image')).rejects.toThrow('requires sign-in');
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
