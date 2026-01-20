import { z } from 'zod';
import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { getIdleMenu } from './cancelHandler';

export interface ValidationResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export interface BaseHandlerConfig<T> {
    schema: z.ZodSchema<T>;
    currentState: string;
    onSuccess: (data: T, context: HandlerContext) => Promise<HandlerResult>;
    onCancel?: (context: HandlerContext) => Promise<HandlerResult>;
    cancelAllowed?: boolean;
}

// default cancel behavior: return to IDLE with menu
async function defaultOnCancel(_context: HandlerContext): Promise<HandlerResult> {
    return {
        nextState: States.IDLE,
        response: `Action cancelled.

${getIdleMenu()}`,
        data: {
            currentRecipient: undefined,
            transferId: undefined,
            selectedRecipientId: undefined,
            selectedBankAccountId: undefined,
            plaidData: undefined,
            bankKey: undefined
        }
    };
}

export function createHandler<T>(config: BaseHandlerConfig<T>) {
    const { schema, currentState, onSuccess, onCancel, cancelAllowed = true } = config;

    return async (context: HandlerContext): Promise<HandlerResult> => {
        const input = context.message.trim();
        const upperInput = input.toUpperCase();

        // check for CANCEL if allowed
        if (cancelAllowed && upperInput === 'CANCEL') {
            const cancelHandler = onCancel || defaultOnCancel;
            return cancelHandler(context);
        }

        // validate input with schema
        const result = schema.safeParse(input);

        if (!result.success) {
            // extract first error message
            const errorMessage = result.error.issues[0]?.message || 'Invalid input.';

            return {
                nextState: currentState,
                response: `${errorMessage}

Or type CANCEL to abort.`
            };
        }

        // valid input - call success handler
        return onSuccess(result.data, context);
    };
}
