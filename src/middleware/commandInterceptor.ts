import { HandlerContext, HandlerResult } from '../types/handler';
import { SessionDataContent } from '../types/session';
import { States } from '../constants/states';
import * as globalCommands from '../handlers/globalCommands';

export interface InterceptResult {
    handled: boolean;
    result?: HandlerResult;
}

type CommandHandler = (context: HandlerContext) => Promise<HandlerResult>;

const commandHandlers: Record<string, CommandHandler> = {
    'HELP': globalCommands.handleHelp,
    'STATUS': globalCommands.handleStatus,
    'RATE': globalCommands.handleRate,
    'FEES': globalCommands.handleFees,
    'BANKS': globalCommands.handleBanks,
    'ADD BANK': globalCommands.handleAddBank,
    'RECIPIENTS': globalCommands.handleRecipients,
    'PROFILE': globalCommands.handleProfile,
    'CANCEL': globalCommands.handleCancel,
    'NEW': globalCommands.handleNew,
    'CONFIRM REMOVE': globalCommands.handleConfirmRemove
};

const globalCommandsList = [
    'HELP', 'STATUS', 'RATE', 'FEES', 'BANKS', 'RECIPIENTS',
    'PROFILE', 'NEW', 'ADD BANK'
];

function isGlobalCommand(command: string): boolean {
    return globalCommandsList.includes(command) ||
        /^DEFAULT\s+\d+$/.test(command) ||
        /^REMOVE\s+(?:BANK\s+)?\d+$/.test(command) ||
        command === 'CONFIRM REMOVE';
}

export async function interceptCommand(
    context: HandlerContext,
    currentState: string,
    sessionData: SessionDataContent
): Promise<InterceptResult> {
    const command = context.message.toUpperCase().trim();

    // block all commands if transfer is processing
    if (sessionData.transferProcessing) {
        return {
            handled: true,
            result: {
                nextState: currentState,
                response: `Transfer in progress. Please wait for completion.
You will receive status updates automatically.`
            }
        };
    }

    // if not in idle state, only allow cancel
    if (currentState !== States.IDLE) {
        if (command === 'CANCEL') {
            const result = await globalCommands.handleCancel(context);
            return { handled: true, result };
        }

        if (isGlobalCommand(command)) {
            return {
                handled: true,
                result: {
                    nextState: currentState,
                    response: `This action is not available right now.

You can:
• Complete the current step
• Type CANCEL to abort and return to menu`
                }
            };
        }

        return { handled: false };
    }

    // in idle state, process commands from handler map
    const handler = commandHandlers[command];
    if (handler) {
        const result = await handler(context);
        return { handled: true, result };
    }

    // check for default bank command
    const defaultMatch = command.match(/^DEFAULT\s+(\d+)$/);
    if (defaultMatch) {
        const bankNumber = parseInt(defaultMatch[1], 10);
        const result = await globalCommands.handleSetDefault(context, bankNumber);
        return { handled: true, result };
    }

    // check for remove bank command
    const removeMatch = command.match(/^REMOVE\s+(?:BANK\s+)?(\d+)$/);
    if (removeMatch) {
        const bankNumber = parseInt(removeMatch[1], 10);
        const result = await globalCommands.handleRemoveBank(context, bankNumber);
        return { handled: true, result };
    }

    return { handled: false };
}

