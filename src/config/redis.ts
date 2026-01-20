import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let isConnected = false;

export async function initRedis(): Promise<RedisClientType | null> {
    if (!process.env.REDIS_URL) {
        console.warn('REDIS_URL not set, using postgres fallback for sessions');
        return null;
    }

    try {
        client = createClient({
            url: process.env.REDIS_URL
        });

        // handle errors gracefully without crashing the app
        client.on('error', (err) => {
            console.warn('redis error (using fallback):', err.message);
            isConnected = false;
        });

        client.on('connect', () => {
            console.log('redis connected');
            isConnected = true;
        });

        client.on('reconnecting', () => {
            console.log('redis reconnecting...');
        });

        client.on('ready', () => {
            console.log('redis ready');
            isConnected = true;
        });

        client.on('end', () => {
            console.log('redis connection closed');
            isConnected = false;
        });

        await client.connect();
        return client;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        console.warn('failed to connect to redis (using fallback):', errorMessage);
        isConnected = false;
        return null;
    }
}

export function getRedisClient(): RedisClientType | null {
    if (!client || !isConnected) {
        return null;
    }
    return client;
}

export function isRedisConnected(): boolean {
    return isConnected;
}

// safe wrapper for redis ping
export async function pingRedis(): Promise<boolean> {
    if (!client || !isConnected) {
        return false;
    }

    try {
        await client.ping();
        return true;
    } catch {
        return false;
    }
}

