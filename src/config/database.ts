import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

// configure connection pool based on environment
const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined
};

export const pool = new Pool(poolConfig);

// delay helper for retry logic
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// test database connection with retry logic
export async function testConnection(): Promise<boolean> {
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await pool.query('SELECT 1');
            console.log('database connected successfully');
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            console.error(`database connection attempt ${attempt}/${maxRetries} failed:`, errorMessage);

            if (attempt < maxRetries) {
                const waitTime = retryDelays[attempt - 1];
                console.log(`waiting ${waitTime}ms before retry...`);
                await delay(waitTime);
            }
        }
    }

    console.error('database connection failed after all retries');
    return false;
}

// generic typed query helper for all database operations
export async function query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
}

