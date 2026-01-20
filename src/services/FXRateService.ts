import axios from 'axios';
import { getRedisClient, isRedisConnected } from '../config/redis';
import * as logger from '../utils/logger';

export interface FXRateResult {
    rate: number;
    source: 'live' | 'cached' | 'fallback';
    fetchedAt: Date;
}

export interface QuoteResult {
    amountUsd: number;
    feeUsd: number;
    feePercentage: string;
    fxRate: number;
    amountInr: number;
}

const FALLBACK_RATE = 83.50;
const CACHE_TTL = 30;
const CACHE_KEY = 'fx_rate:USD_INR';

export async function getFXRate(): Promise<FXRateResult> {
    // try to get from redis cache first
    if (isRedisConnected()) {
        try {
            const client = getRedisClient();
            if (client) {
                const cached = await client.get(CACHE_KEY);
                if (cached) {
                    const data = JSON.parse(cached);
                    return {
                        rate: data.rate,
                        source: 'cached',
                        fetchedAt: new Date(data.fetchedAt)
                    };
                }
            }
        } catch (error) {
            logger.warn('redis cache read failed', { error });
        }
    }

    // fetch from api
    const apiKey = process.env.FX_API_KEY;

    if (!apiKey) {
        logger.warn('FX_API_KEY not set, using fallback rate');
        return {
            rate: FALLBACK_RATE,
            source: 'fallback',
            fetchedAt: new Date()
        };
    }

    try {
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/INR`;
        const response = await axios.get(url, { timeout: 5000 });
        const rate = response.data.conversion_rate;

        // cache the rate in redis
        if (isRedisConnected()) {
            try {
                const client = getRedisClient();
                if (client) {
                    const cacheData = {
                        rate,
                        fetchedAt: new Date().toISOString()
                    };
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(cacheData));
                }
            } catch (error) {
                logger.warn('redis cache write failed', { error });
            }
        }

        return {
            rate,
            source: 'live',
            fetchedAt: new Date()
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        logger.error('fx api request failed', { error: errorMessage });

        return {
            rate: FALLBACK_RATE,
            source: 'fallback',
            fetchedAt: new Date()
        };
    }
}

export async function getLiveFXRate(): Promise<FXRateResult | null> {
    const apiKey = process.env.FX_API_KEY;

    if (!apiKey) {
        logger.error('FX_API_KEY not set, cannot fetch live rate');
        return null;
    }

    try {
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/INR`;
        const response = await axios.get(url, { timeout: 5000 });
        const rate = response.data.conversion_rate;

        if (!rate || typeof rate !== 'number') {
            logger.error('invalid rate from fx api', { rate });
            return null;
        }

        // also update cache for other uses
        if (isRedisConnected()) {
            try {
                const client = getRedisClient();
                if (client) {
                    const cacheData = {
                        rate,
                        fetchedAt: new Date().toISOString()
                    };
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(cacheData));
                }
            } catch {
                // non-critical
            }
        }

        return {
            rate,
            source: 'live',
            fetchedAt: new Date()
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        logger.error('fx api request failed', { error: errorMessage });
        return null;
    }
}

export function calculateFee(amountUsd: number): number {
    // dynamic fee: minimum of 0.1% or $2.00
    const percentageFee = amountUsd * 0.001;
    return Math.min(percentageFee, 2.00);
}

export function calculateQuote(amountUsd: number, fxRate: number): QuoteResult {
    const feeUsd = calculateFee(amountUsd);
    const netAmount = amountUsd - feeUsd;
    const amountInr = netAmount * fxRate;

    // determine fee display string
    const feePercentage = feeUsd < 2.00 ? '0.1%' : 'max $2';

    return {
        amountUsd: parseFloat(amountUsd.toFixed(2)),
        feeUsd: parseFloat(feeUsd.toFixed(2)),
        feePercentage,
        fxRate: parseFloat(fxRate.toFixed(4)),
        amountInr: parseFloat(amountInr.toFixed(2))
    };
}
