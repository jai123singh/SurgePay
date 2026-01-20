import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import { testConnection, pool } from './config/database';
import { initRedis, pingRedis, isRedisConnected } from './config/redis';
import { initTwilioClient } from './services/TwilioService';
import * as BackgroundJobService from './services/BackgroundJobService';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

// load environment variables first
// load environment variables first (done via import 'dotenv/config')

// initialize twilio client
initTwilioClient();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// comprehensive health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
    let dbStatus = 'down';
    let redisStatus = 'down';

    // test database connection
    try {
        await pool.query('SELECT 1');
        dbStatus = 'up';
    } catch {
        dbStatus = 'down';
    }

    // test redis connection
    const redisUp = await pingRedis();
    redisStatus = redisUp ? 'up' : (isRedisConnected() ? 'degraded' : 'down');

    // determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (dbStatus === 'down') {
        overallStatus = 'unhealthy';
    } else if (redisStatus !== 'up') {
        overallStatus = 'degraded';
    }

    res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        services: {
            database: dbStatus,
            redis: redisStatus
        },
        activeJobs: BackgroundJobService.getActiveJobCount()
    });
});

// mount api routes
app.use('/api', routes);

// error handler middleware (must be after routes)
app.use(errorHandler);

// graceful shutdown handler
function handleShutdown(): void {
    console.log('shutting down...');
    BackgroundJobService.cancelAllJobs();
    process.exit(0);
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// start server after verifying database connection
async function startServer(): Promise<void> {
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.error('failed to connect to database, exiting');
        process.exit(1);
    }

    // initialize redis (non-blocking, will use postgres fallback if fails)
    const redisClient = await initRedis();
    if (redisClient) {
        console.log('redis initialized for sessions');
    } else {
        console.log('redis not available, using postgres for sessions');
    }

    app.listen(PORT, () => {
        console.log(`server running on port ${PORT}`);
    });
}

startServer();

export default app;





