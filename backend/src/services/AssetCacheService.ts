import { createHash } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/Logger.js';
import type { EventConfig } from '../types.js';

type CacheState = 'pending' | 'downloading' | 'ready' | 'error';

const ASSET_TYPES = {
    image: { dir: 'img' },
    sound: { dir: 'audio' },
    video: { dir: 'video' },
} as const;

type AssetType = keyof typeof ASSET_TYPES;

export const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg':    'jpg',
    'image/png':     'png',
    'image/gif':     'gif',
    'audio/mpeg':    'mp3',
    'audio/mp4':     'm4a',
    'audio/x-m4a':  'm4a',
    'video/mp4':     'mp4',
};

const ALLOWED_MIMES: Record<AssetType, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif'],
    sound: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a'],
    video: ['video/mp4'],
};

// Hosts like Dropbox serve files with a generic/opaque Content-Type; for these
// we ignore the header and detect the real type from the bytes or URL instead.
const GENERIC_MIMES = new Set([
    '', 'application/binary', 'application/octet-stream',
    'binary/octet-stream', 'application/download',
]);

const EXT_TO_MIME: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    mp3: 'audio/mpeg', m4a: 'audio/x-m4a', mp4: 'video/mp4',
};

function sniffMime(buffer: Buffer): string | undefined {
    const b = buffer;
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a')) return 'image/gif';
    if (b.length >= 3 && b.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg';
    if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg';
    if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') {
        return b.toString('ascii', 8, 11) === 'M4A' ? 'audio/mp4' : 'video/mp4';
    }
    return undefined;
}

function mimeFromUrlExt(url: string): string | undefined {
    const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
    return ext ? EXT_TO_MIME[ext] : undefined;
}

/**
 * Resolve the canonical MIME type for a downloaded asset. A specific, known
 * Content-Type is trusted; a specific-but-unsupported one is rejected; a
 * generic one (e.g. Dropbox's application/binary) is resolved by sniffing the
 * magic bytes, then falling back to the URL's file extension.
 */
export function resolveAssetMime(headerMime: string, buffer: Buffer, url: string): string | undefined {
    if (MIME_TO_EXT[headerMime]) return headerMime;
    if (!GENERIC_MIMES.has(headerMime)) return undefined;
    return sniffMime(buffer) ?? mimeFromUrlExt(url);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CACHE_ROOT = join(__dirname, '../../../../cache');

function normalizeGoogleUrl(url: string): string {
    const ucMatch = url.match(/drive\.google\.com\/(?:open|uc)\?.*?[?&]id=([^&]+)/);
    if (ucMatch) return `https://drive.usercontent.google.com/download?id=${ucMatch[1]}&export=download&authuser=0`;
    return url;
}

async function fetchAsset(url: string): Promise<Response> {
    const response = await fetch(url);

    if (response.url.includes('accounts.google.com')) {
        throw new Error('This Google Drive file requires sign-in. Set sharing to "Anyone on the internet with this link".');
    }

    if (!response.ok) return response;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('text/html') || !/google\.com/.test(url)) return response;

    // Google returned a confirmation page — parse the form and resubmit
    const html = await response.text();
    const actionMatch = html.match(/action="([^"]+)"/);
    if (!actionMatch) return response;

    const action = actionMatch[1].replace(/&amp;/g, '&');
    const base = action.startsWith('http') ? action : `https://drive.google.com${action}`;
    const params = new URLSearchParams();
    for (const [, name, value] of html.matchAll(/name="([^"]+)"\s+value="([^"]*)"/g)) {
        params.set(name, value);
    }

    if (!params.has('id')) return response;

    Logger.info(`AssetCacheService: Following Google Drive confirmation for ${url}`);
    return fetch(`${base}?${params}`);
}

export function isExternalUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
}

export function extractAssetUrls(configs: EventConfig[]): { url: string; assetType: AssetType }[] {
    const seen = new Set<string>();
    const results: { url: string; assetType: AssetType }[] = [];

    for (const config of configs) {
        for (const reaction of config.reactions) {
            let url: string | undefined;
            let assetType: AssetType | undefined;

            if (reaction.type === 'image' && isExternalUrl(reaction.url)) {
                url = reaction.url; assetType = 'image';
            } else if (reaction.type === 'sound' && isExternalUrl(reaction.filename)) {
                url = reaction.filename; assetType = 'sound';
            } else if (reaction.type === 'video' && isExternalUrl(reaction.filename)) {
                url = reaction.filename; assetType = 'video';
            }

            if (url && assetType && !seen.has(url)) {
                seen.add(url);
                results.push({ url, assetType });
            }
        }
    }

    return results;
}

type ProgressCallback = (current: number, total: number, done: boolean) => void;

export class AssetCacheService {
    private state: CacheState = 'pending';
    private connectionCount = 0;
    private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    private progressCallback: ProgressCallback | null = null;
    private urlExtensionMap = new Map<string, string>();

    setProgressCallback(cb: ProgressCallback): void {
        this.progressCallback = cb;
    }

    private broadcastProgress(current: number, total: number, done: boolean): void {
        this.progressCallback?.(current, total, done);
    }

    private get channelHash(): string {
        return createHash('sha256')
            .update(process.env.TWITCH_CHANNEL_NAME ?? 'default')
            .digest('hex')
            .slice(0, 12);
    }

    private get cacheDir(): string {
        return join(CACHE_ROOT, this.channelHash);
    }

    getHash(): string { return this.channelHash; }

    async ensureReady(configs: EventConfig[]): Promise<void> {
        if (this.state === 'ready' || this.state === 'downloading') return;

        this.state = 'downloading';
        try {
            await this.download(configs);
            this.state = 'ready';
            Logger.info(`AssetCacheService: Cache ready at ${this.cacheDir}`);
        } catch (error) {
            this.state = 'error';
            this.broadcastProgress(0, 0, true);
            Logger.error('AssetCacheService: Download failed', error);
        }
    }

    onConnect(): void {
        this.connectionCount++;
        if (this.cleanupTimer !== null) {
            clearTimeout(this.cleanupTimer);
            this.cleanupTimer = null;
            Logger.info('AssetCacheService: Cleanup timer cancelled (reconnection)');
        }
    }

    onDisconnect(): void {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        if (this.connectionCount === 0) {
            Logger.info('AssetCacheService: All connections closed — cleanup in 1 hour');
            this.cleanupTimer = setTimeout(() => void this.cleanup(), 60 * 60 * 1000);
        }
    }

    invalidate(): void {
        this.state = 'pending';
        this.urlExtensionMap.clear();
        Logger.info('AssetCacheService: Cache invalidated');
    }

    async previewUrl(url: string, assetType: AssetType): Promise<string> {
        if (!isExternalUrl(url)) throw new Error('Must be an external URL');

        const fetchUrl = normalizeGoogleUrl(url);

        const existingExt = this.urlExtensionMap.get(url);
        if (existingExt) {
            const { dir } = ASSET_TYPES[assetType];
            const filename = `${createHash('sha256').update(url).digest('hex').slice(0, 12)}.${existingExt}`;
            return `/cache/${this.channelHash}/${dir}/${filename}`;
        }

        await mkdir(join(this.cacheDir, ASSET_TYPES[assetType].dir), { recursive: true });

        const response = await fetchAsset(fetchUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const headerMime = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
        const buffer = Buffer.from(await response.arrayBuffer());
        const mimeType = resolveAssetMime(headerMime, buffer, url);

        if (!mimeType) throw new Error(`Unsupported content type: ${headerMime || '(none)'}`);
        if (!ALLOWED_MIMES[assetType].includes(mimeType)) throw new Error(`"${mimeType}" is not valid for ${assetType}`);

        const ext = MIME_TO_EXT[mimeType];
        const { dir } = ASSET_TYPES[assetType];
        const filename = `${createHash('sha256').update(url).digest('hex').slice(0, 12)}.${ext}`;
        const dest = join(this.cacheDir, dir, filename);

        await writeFile(dest, buffer);
        this.urlExtensionMap.set(url, ext);

        Logger.info(`AssetCacheService: Previewed and cached ${url}`);
        return `/cache/${this.channelHash}/${dir}/${filename}`;
    }

    resolve(value: string, assetType: AssetType): string {
        if (!isExternalUrl(value) || this.state !== 'ready') return '';

        const ext = this.urlExtensionMap.get(value);
        if (!ext) return '';

        const { dir } = ASSET_TYPES[assetType];
        const filename = `${createHash('sha256').update(value).digest('hex').slice(0, 12)}.${ext}`;
        return `/cache/${this.channelHash}/${dir}/${filename}`;
    }

    private async download(configs: EventConfig[]): Promise<void> {
        for (const { dir } of Object.values(ASSET_TYPES)) {
            await mkdir(join(this.cacheDir, dir), { recursive: true });
        }

        const assets = extractAssetUrls(configs);
        Logger.info(`AssetCacheService: Downloading ${assets.length} asset(s)`);

        if (assets.length === 0) return;

        this.broadcastProgress(0, assets.length, false);
        let completed = 0;

        await Promise.all(assets.map(async ({ url, assetType }) => {
            try {
                const response = await fetchAsset(normalizeGoogleUrl(url));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const headerMime = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
                const buffer = Buffer.from(await response.arrayBuffer());
                const mimeType = resolveAssetMime(headerMime, buffer, url);

                if (!mimeType) {
                    Logger.warn(`AssetCacheService: Unsupported content-type "${headerMime}" for ${url}, skipping`);
                    return;
                }
                if (!ALLOWED_MIMES[assetType].includes(mimeType)) {
                    Logger.warn(`AssetCacheService: "${mimeType}" not allowed for ${assetType} reaction, skipping`);
                    return;
                }

                const ext = MIME_TO_EXT[mimeType];
                const { dir } = ASSET_TYPES[assetType];
                const filename = `${createHash('sha256').update(url).digest('hex').slice(0, 12)}.${ext}`;
                const dest = join(this.cacheDir, dir, filename);

                await writeFile(dest, buffer);
                this.urlExtensionMap.set(url, ext);
                Logger.info(`AssetCacheService: Cached ${url} as ${ext}`);
            } catch (error) {
                Logger.error(`AssetCacheService: Failed to download ${url}`, error);
            }

            completed++;
            this.broadcastProgress(completed, assets.length, false);
        }));

        this.broadcastProgress(assets.length, assets.length, true);
    }

    private async cleanup(): Promise<void> {
        try {
            if (existsSync(this.cacheDir)) {
                await rm(this.cacheDir, { recursive: true });
            }
            this.state = 'pending';
            this.cleanupTimer = null;
            this.urlExtensionMap.clear();
            Logger.info(`AssetCacheService: Cache cleaned up`);
        } catch (error) {
            Logger.error('AssetCacheService: Cleanup failed', error);
        }
    }
}

const assetCacheService = new AssetCacheService();
export default assetCacheService;
