import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';

export function getIdleMenu(): string {
    return `━━━━━━━━━━━━━━━━━━━━
All Commands
━━━━━━━━━━━━━━━━━━━━
NEW - Start new transfer
STATUS - View recent transfers
HELP - View all commands
RATE - Check exchange rate
FEES - View fee structure
BANKS - Manage bank accounts
RECIPIENTS - View recipients
PROFILE - View your profile
━━━━━━━━━━━━━━━━━━━━`;
}

export function getClearedSessionData() {
    return {
        currentRecipient: undefined,
        transferId: undefined,
        selectedRecipientId: undefined,
        selectedBankAccountId: undefined,
        plaidData: undefined,
        bankKey: undefined,
        addingBank: undefined,
        awaitingRemoveConfirm: undefined,
        bankToRemove: undefined,
        fxUpdateJobId: undefined,
        quoteStartedAt: undefined
    };
}

export async function handleCancel(_context: HandlerContext): Promise<HandlerResult> {
    return {
        nextState: States.IDLE,
        response: `Action cancelled.

${getIdleMenu()}`,
        data: getClearedSessionData(),
        template: 'idle_menu'
    };
}
