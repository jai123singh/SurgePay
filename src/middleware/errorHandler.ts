import { Request, Response, NextFunction } from 'express';
import * as logger from '../utils/logger';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // log the full error details for debugging
    logger.error('unhandled express error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // never expose internal error details to client
    res.status(500).json({
        error: 'Something went wrong. Please try again.'
    });
}
