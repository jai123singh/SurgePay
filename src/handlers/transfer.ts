import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { AmountSchema, QuoteActionSchema, PayActionSchema } from '../schemas';
import { getIdleMenu, getClearedSessionData } from './cancelHandler';
import { generateTransferCode } from '../utils/transferCodeGenerator';
import * as FXRateService from '../services/FXRateService';
import * as Transfer from '../models/Transfer';
import * as Recipient from '../models/Recipient';
import * as UserBankAccount from '../models/UserBankAccount';
import * as BackgroundJobService from '../services/BackgroundJobService';
import * as SessionService from '../services/SessionService';

export async function handleAskingAmount(context: HandlerContext): Promise<HandlerResult> {
    const { message, user, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();

    // check for cancel
    if (upperInput === 'CANCEL') {
        return {
            nextState: States.IDLE,
            response: `Action cancelled.

${getIdleMenu()}`,
            data: getClearedSessionData()
        };
    }

    // validate with zod
    const result = AmountSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_AMOUNT,
            response: `${result.error.issues[0]?.message || 'Please enter a valid amount.'}

Enter amount between $10 and $10,000.

Or type CANCEL to abort.`
        };
    }

    const amountUsd = result.data;

    if (!user) {
        return {
            nextState: States.INITIAL,
            response: 'Something went wrong. Please type Hi to start over.'
        };
    }

    const recipientId = sessionData.selectedRecipientId;
    if (!recipientId) {
        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: 'Please select a recipient first. Enter a nickname:'
        };
    }

    // check for duplicate active transfer
    const existingTransfer = await Transfer.findActive(user.id, recipientId, amountUsd);
    if (existingTransfer) {
        return {
            nextState: States.IDLE,
            response: `You already have an active transfer (${existingTransfer.transfer_code}) for this amount.

Type STATUS to check progress.

${getIdleMenu()}`
        };
    }

    // get recipient details
    const recipient = await Recipient.findById(recipientId);
    if (!recipient) {
        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: 'Recipient not found. Please enter a nickname:'
        };
    }

    // get live fx rate (no cache, no fallback)
    const fxResult = await FXRateService.getLiveFXRate();

    if (!fxResult) {
        return {
            nextState: States.IDLE,
            response: `Unable to fetch live exchange rate.

Please try again in a few moments.

${getIdleMenu()}`,
            template: 'idle_menu'
        };
    }

    const quote = FXRateService.calculateQuote(amountUsd, fxResult.rate);

    // generate transfer code and calculate expiry
    const transferCode = generateTransferCode();
    const quoteExpiresAt = new Date();
    quoteExpiresAt.setMinutes(quoteExpiresAt.getMinutes() + 5);

    // create transfer record
    const transfer = await Transfer.create({
        transfer_code: transferCode,
        user_id: user.id,
        recipient_id: recipientId,
        amount_usd: quote.amountUsd,
        fx_rate: quote.fxRate,
        fee_usd: quote.feeUsd,
        amount_inr: quote.amountInr,
        status: 'quote',
        quote_expires_at: quoteExpiresAt
    });

    const recipientInfo = recipient.payment_method === 'upi'
        ? recipient.upi_id
        : `****${recipient.account_number?.slice(-4)}`;

    // start fx update job
    const fxJobId = BackgroundJobService.startFXUpdateJob(
        context.phoneNumber,
        transfer.id,
        {
            recipientName: recipient.nickname,
            amountUsd: quote.amountUsd,
            transferCode: transferCode
        },
        async () => {
            // on fx fetch error, send message to user
            const session = await SessionService.getSession(context.phoneNumber);
            if (session) {
                await SessionService.updateSession(context.phoneNumber, States.IDLE, {
                    ...getClearedSessionData(),
                    fxUpdateJobId: undefined
                });
            }
        }
    );

    return {
        nextState: States.SHOWING_QUOTE,
        response: `Fetching live exchange rate...

✓ Quote Ready!

━━━━━━━━━━━━━━━━━━━━
Transfer Quote (${transferCode})
━━━━━━━━━━━━━━━━━━━━
You send: $${quote.amountUsd.toFixed(2)} USD
Fee: $${quote.feeUsd.toFixed(2)} (${quote.feePercentage})
Rate: 1 USD = ₹${quote.fxRate.toFixed(4)} (live)
━━━━━━━━━━━━━━━━━━━━
${recipient.nickname} receives: ₹${quote.amountInr.toFixed(2)}
via ${recipient.payment_method.toUpperCase()}: ${recipientInfo}
━━━━━━━━━━━━━━━━━━━━

⏱️ Rate updates every 30 seconds
⏰ Quote valid for 5 minutes`,
        data: {
            transferId: transfer.id,
            fxUpdateJobId: fxJobId,
            quoteStartedAt: new Date().toISOString()
        },
        template: 'confirm_cancel'
    };
}

export async function handleShowingQuote(context: HandlerContext): Promise<HandlerResult> {
    const { message, user, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();

    // check for cancel
    if (upperInput === 'CANCEL') {
        const transferId = sessionData.transferId;
        const fxJobId = sessionData.fxUpdateJobId;

        if (fxJobId) {
            BackgroundJobService.stopFXUpdateJob(fxJobId);
        }

        if (transferId) {
            await Transfer.updateStatus(transferId, 'cancelled');
        }

        return {
            nextState: States.IDLE,
            response: `Transfer cancelled.

${getIdleMenu()}`,
            data: { ...getClearedSessionData(), fxUpdateJobId: undefined },
            template: 'idle_menu'
        };
    }

    // validate with zod
    const result = QuoteActionSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.SHOWING_QUOTE,
            response: `Invalid response.`,
            template: 'confirm_cancel'
        };
    }

    // confirm path
    const transferId = sessionData.transferId;
    const fxJobId = sessionData.fxUpdateJobId;

    // stop fx updates since user is confirming
    if (fxJobId) {
        BackgroundJobService.stopFXUpdateJob(fxJobId);
    }

    if (!transferId) {
        return {
            nextState: States.IDLE,
            response: `Session expired.

${getIdleMenu()}`
        };
    }

    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        return {
            nextState: States.IDLE,
            response: `Transfer not found.

${getIdleMenu()}`
        };
    }

    if (transfer.status !== 'quote') {
        return {
            nextState: States.IDLE,
            response: `This transfer (${transfer.transfer_code}) has already been processed.

Type STATUS to check progress.

${getIdleMenu()}`
        };
    }

    // check if quote has expired
    if (transfer.quote_expires_at && new Date() > transfer.quote_expires_at) {
        await Transfer.updateStatus(transfer.id, 'cancelled');
        return {
            nextState: States.IDLE,
            response: `Quote expired. The rate has changed.

Reply NEW to get a fresh quote.

${getIdleMenu()}`,
            data: { transferId: undefined }
        };
    }

    if (!user) {
        return {
            nextState: States.INITIAL,
            response: 'Something went wrong. Please type Hi to start over.'
        };
    }

    const accounts = await UserBankAccount.findByUser(user.id);

    if (accounts.length === 0) {
        return {
            nextState: States.INITIATING_PLAID,
            response: 'You need to link a bank account first.',
            template: 'link_bank'
        };
    }

    if (accounts.length === 1) {
        const account = accounts[0];
        const last4 = account.account_number.slice(-4);

        const recipient = await Recipient.findById(transfer.recipient_id);
        const recipientInfo = recipient?.payment_method === 'upi'
            ? recipient.upi_id
            : `****${recipient?.account_number?.slice(-4)}`;

        return {
            nextState: States.CONFIRMING_TRANSFER,
            response: `Confirm transfer details:

━━━━━━━━━━━━━━━━━━━━
Transfer ${transfer.transfer_code}
━━━━━━━━━━━━━━━━━━━━
From: ${account.bank_name} (****${last4})
To: ${recipient?.nickname || 'Recipient'} (${recipientInfo})
━━━━━━━━━━━━━━━━━━━━
Amount: $${transfer.amount_usd.toFixed(2)} USD
Fee: $${transfer.fee_usd.toFixed(2)}
Rate: 1 USD = ₹${transfer.fx_rate.toFixed(4)}
━━━━━━━━━━━━━━━━━━━━
They receive: ₹${transfer.amount_inr.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━

⚠️ $${transfer.amount_usd.toFixed(2)} will be withdrawn from your bank.`,
            data: { selectedBankAccountId: account.id },
            template: 'pay_cancel'
        };
    }

    // multiple accounts
    let accountList = 'Select bank account:\n\n';
    accounts.forEach((account, index) => {
        const last4 = account.account_number.slice(-4);
        const defaultMark = account.is_default ? ' ⭐' : '';
        accountList += `${index + 1}. ${account.bank_name} (****${last4})${defaultMark}\n`;
    });
    accountList += '\nReply with the number of your choice.\nOr type CANCEL to abort.';

    return {
        nextState: States.BANK_ACCOUNT_SELECTION,
        response: accountList
    };
}

export async function handleBankAccountSelection(context: HandlerContext): Promise<HandlerResult> {
    const { message, user, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();

    // check for cancel
    if (upperInput === 'CANCEL') {
        const transferId = sessionData.transferId;
        if (transferId) {
            await Transfer.updateStatus(transferId, 'cancelled');
        }

        return {
            nextState: States.IDLE,
            response: `Transfer cancelled.

${getIdleMenu()}`,
            data: getClearedSessionData()
        };
    }

    if (!user) {
        return {
            nextState: States.INITIAL,
            response: 'Something went wrong. Please type Hi to start over.'
        };
    }

    const accounts = await UserBankAccount.findByUser(user.id);
    const selection = parseInt(input, 10);

    if (isNaN(selection) || selection < 1 || selection > accounts.length) {
        let accountList = 'Invalid selection. Please choose:\n\n';
        accounts.forEach((account, index) => {
            const last4 = account.account_number.slice(-4);
            const defaultMark = account.is_default ? ' ⭐' : '';
            accountList += `${index + 1}. ${account.bank_name} (****${last4})${defaultMark}\n`;
        });
        accountList += '\nReply with the number.\nOr type CANCEL to abort.';

        return {
            nextState: States.BANK_ACCOUNT_SELECTION,
            response: accountList
        };
    }

    const selectedAccount = accounts[selection - 1];
    const last4 = selectedAccount.account_number.slice(-4);

    const transferId = sessionData.transferId;
    if (!transferId) {
        return {
            nextState: States.IDLE,
            response: `Session expired.

${getIdleMenu()}`
        };
    }

    const transfer = await Transfer.findById(transferId);
    if (!transfer) {
        return {
            nextState: States.IDLE,
            response: `Transfer not found.

${getIdleMenu()}`
        };
    }

    const recipient = await Recipient.findById(transfer.recipient_id);
    const recipientInfo = recipient?.payment_method === 'upi'
        ? recipient.upi_id
        : `****${recipient?.account_number?.slice(-4)}`;

    return {
        nextState: States.CONFIRMING_TRANSFER,
        response: `Confirm transfer details:

━━━━━━━━━━━━━━━━━━━━
Transfer ${transfer.transfer_code}
━━━━━━━━━━━━━━━━━━━━
From: ${selectedAccount.bank_name} (****${last4})
To: ${recipient?.nickname || 'Recipient'} (${recipientInfo})
━━━━━━━━━━━━━━━━━━━━
Amount: $${transfer.amount_usd.toFixed(2)} USD
Fee: $${transfer.fee_usd.toFixed(2)}
Rate: 1 USD = ₹${transfer.fx_rate.toFixed(4)}
━━━━━━━━━━━━━━━━━━━━
They receive: ₹${transfer.amount_inr.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━

⚠️ $${transfer.amount_usd.toFixed(2)} will be withdrawn from your bank.`,
        data: { selectedBankAccountId: selectedAccount.id },
        template: 'pay_cancel'
    };
}

export async function handleConfirmingTransfer(context: HandlerContext): Promise<HandlerResult> {
    const { message, phoneNumber, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();

    // check for cancel first
    if (upperInput === 'CANCEL') {
        const transferId = sessionData.transferId;
        if (transferId) {
            await Transfer.updateStatus(transferId, 'cancelled');
        }

        return {
            nextState: States.IDLE,
            response: `Transfer cancelled.

${getIdleMenu()}`,
            data: getClearedSessionData()
        };
    }

    // validate with zod
    const result = PayActionSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.CONFIRMING_TRANSFER,
            response: `Invalid response.`,
            template: 'pay_cancel'
        };
    }

    // pay path
    const transferId = sessionData.transferId;
    const bankAccountId = sessionData.selectedBankAccountId;

    if (!transferId) {
        return {
            nextState: States.IDLE,
            response: `Session expired.

${getIdleMenu()}`
        };
    }

    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        return {
            nextState: States.IDLE,
            response: `Transfer not found.

${getIdleMenu()}`
        };
    }

    // critical idempotency check
    if (transfer.status !== 'quote') {
        return {
            nextState: States.IDLE,
            response: `This transfer (${transfer.transfer_code}) has already been processed.

Type STATUS to check progress.

${getIdleMenu()}`
        };
    }

    // get bank account and recipient details
    let bankAccount = null;
    if (bankAccountId) {
        await Transfer.updateBankAccount(transfer.id, bankAccountId);
        bankAccount = await UserBankAccount.findById(bankAccountId);
    }

    const recipient = await Recipient.findById(transfer.recipient_id);

    // update status to processing_withdrawal
    await Transfer.updateStatus(transfer.id, 'processing_withdrawal', 'withdrawal_initiated_at');

    // start background job
    if (bankAccount && recipient) {
        const jobData: BackgroundJobService.TransferJobData = {
            transfer_code: transfer.transfer_code,
            amount_usd: transfer.amount_usd,
            amount_inr: transfer.amount_inr,
            fee_usd: transfer.fee_usd,
            bank_name: bankAccount.bank_name,
            bank_last4: bankAccount.account_number.slice(-4),
            recipient_name: recipient.nickname,
            payment_type: recipient.payment_method === 'upi' ? 'UPI' : 'Bank Account',
            payment_details: recipient.payment_method === 'upi'
                ? recipient.upi_id || ''
                : `****${recipient.account_number?.slice(-4)}`
        };

        const onComplete = async () => {
            try {
                const currentSession = await SessionService.getSession(phoneNumber);
                if (currentSession) {
                    await SessionService.updateSession(phoneNumber, currentSession.state, {
                        ...currentSession.data,
                        transferProcessing: false,
                        activeTransferId: undefined
                    });
                }
            } catch {
                // non-critical
            }
        };

        BackgroundJobService.startStatusNotificationJob(transfer.id, phoneNumber, jobData, onComplete);
    }

    return {
        nextState: States.IDLE,
        response: `✓ Transfer initiated!

━━━━━━━━━━━━━━━━━━━━
${transfer.transfer_code}
━━━━━━━━━━━━━━━━━━━━

Step 1/2: Withdrawing $${transfer.amount_usd.toFixed(2)} from your bank...

You'll receive live updates on progress.`,
        data: {
            transferId: undefined,
            selectedBankAccountId: undefined,
            selectedRecipientId: undefined,
            transferProcessing: true,
            activeTransferId: transfer.id
        }
    };
}
