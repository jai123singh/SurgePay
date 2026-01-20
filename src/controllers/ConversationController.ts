import { States } from '../constants/states';
import { HandlerContext, HandlerResult, StateHandler } from '../types/handler';
import { SessionDataContent } from '../types/session';
import { ContentTemplate } from '../services/TwilioService';
import * as SessionService from '../services/SessionService';
import * as User from '../models/User';
import * as logger from '../utils/logger';
import * as onboardingHandlers from '../handlers/onboarding';
import * as plaidHandlers from '../handlers/plaid';
import * as recipientHandlers from '../handlers/recipient';
import * as transferHandlers from '../handlers/transfer';
import * as globalCommands from '../handlers/globalCommands';
import { interceptCommand } from '../middleware/commandInterceptor';

const stateHandlers: Record<string, StateHandler> = {
    [States.INITIAL]: onboardingHandlers.handleInitial,
    [States.ASKING_NAME]: onboardingHandlers.handleName,
    [States.ASKING_EMAIL]: onboardingHandlers.handleEmail,
    [States.ASKING_DOB]: onboardingHandlers.handleDOB,
    [States.ASKING_ADDRESS]: onboardingHandlers.handleAddress,
    [States.INITIATING_PLAID]: plaidHandlers.handleInitiatingPlaid,
    [States.SELECTING_BANK]: plaidHandlers.handleSelectingBank,
    [States.CONFIRMING_PLAID_BANK]: plaidHandlers.handleConfirmingPlaidBank,
    [States.ASKING_RECIPIENT_NAME]: recipientHandlers.handleRecipientName,
    [States.ASKING_PAYMENT_METHOD]: recipientHandlers.handlePaymentMethod,
    [States.ASKING_UPI_ID]: recipientHandlers.handleUPIId,
    [States.ASKING_ACCOUNT_NUMBER]: recipientHandlers.handleAccountNumber,
    [States.ASKING_IFSC]: recipientHandlers.handleIFSC,
    [States.ASKING_BANK_NAME]: recipientHandlers.handleBankName,
    [States.CONFIRMING_RECIPIENT]: recipientHandlers.handleConfirmingRecipient,
    [States.ASKING_AMOUNT]: transferHandlers.handleAskingAmount,
    [States.SHOWING_QUOTE]: transferHandlers.handleShowingQuote,
    [States.BANK_ACCOUNT_SELECTION]: transferHandlers.handleBankAccountSelection,
    [States.CONFIRMING_TRANSFER]: transferHandlers.handleConfirmingTransfer,
    [States.IDLE]: globalCommands.handleHelp
};

export interface ConversationResult {
    response: string;
    template?: ContentTemplate;
}

export async function handleIncomingMessage(
    from: string,
    messageText: string
): Promise<ConversationResult> {
    try {
        let session = await SessionService.getSession(from);

        if (!session) {
            session = {
                state: States.INITIAL,
                data: {},
                createdAt: new Date().toISOString()
            };
        }

        const user = await User.findByPhone(from);

        const context: HandlerContext = {
            user,
            message: messageText.trim(),
            phoneNumber: from,
            sessionData: session.data
        };

        logger.debug('handling message', {
            from,
            state: session.state,
            message: messageText.substring(0, 50)
        });

        const intercepted = await interceptCommand(context, session.state, session.data);

        if (intercepted.handled && intercepted.result) {
            const result = intercepted.result;

            const newData: SessionDataContent = {
                ...session.data,
                ...(result.data || {})
            };

            await SessionService.updateSession(from, result.nextState, newData);

            logger.debug('global command handled', {
                command: messageText.toUpperCase().trim(),
                newState: result.nextState
            });

            return { response: result.response, template: result.template };
        }

        const handler = stateHandlers[session.state];

        if (!handler) {
            logger.warn('no handler for state', { state: session.state });
            return { response: 'Something went wrong. Please type "Hi" to start over.' };
        }

        const result: HandlerResult = await handler(context);

        const newData: SessionDataContent = {
            ...session.data,
            ...(result.data || {})
        };

        await SessionService.updateSession(from, result.nextState, newData);

        logger.debug('state transition', {
            from: session.state,
            to: result.nextState
        });

        return { response: result.response, template: result.template };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        logger.error('conversation error', { from, error: errorMessage });
        return { response: 'Something went wrong. Please try again in a moment.' };
    }
}
