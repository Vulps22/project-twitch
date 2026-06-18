import { createHash } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/Logger.js';
import type { EventConfig } from '../types.js';

type CacheState = 'pending' | 'downloading' | 'ready' | 'error';

const ASSET_TYPES = {
    image: { dir: 'img',   extensions: ['jpg', 'jpeg', 'png', 'gif'] },
    sound: { dir: 'audio', extensions: ['mp3', 'm4a'] },
    video: { dir: 'video', extensions: ['mp4'] },
} as const;

type AssetType = keyof typeof ASSET_TYPES;

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CACHE_ROOT = join(__dirname, '../../../../cache');

export function isExternalUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
}

export function extractExtension(value: string): string | null {
    const clean = value.split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : null;
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
            Logger.error('AssetCacheService: Download failed, falling back to original URLs', error);
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

    resolve(value: string, assetType: AssetType): string {
        if (!isExternalUrl(value) || this.state !== 'ready') return '';

        const ext = extractExtension(value);
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
            const ext = extractExtension(url);
            if (!ext) { Logger.warn(`AssetCacheService: No extension for ${url}, skipping`); return; }

            const { dir, extensions } = ASSET_TYPES[assetType];
            if (!(extensions as readonly string[]).includes(ext)) {
                Logger.warn(`AssetCacheService: Unsupported extension .${ext} for ${assetType}, skipping`);
                return;
            }

            const filename = `${createHash('sha256').update(url).digest('hex').slice(0, 12)}.${ext}`;
            const dest = join(this.cacheDir, dir, filename);

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const buffer = await response.arrayBuffer();
                await writeFile(dest, Buffer.from(buffer));
                Logger.info(`AssetCacheService: Cached ${url}`);
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
            Logger.info(`AssetCacheService: Cache cleaned up`);
        } catch (error) {
            Logger.error('AssetCacheService: Cleanup failed', error);
        }
    }
}

const assetCacheService = new AssetCacheService();
export default assetCacheService;
