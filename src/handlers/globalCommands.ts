import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { getIdleMenu, getClearedSessionData } from './cancelHandler';
import * as Transfer from '../models/Transfer';
import * as Recipient from '../models/Recipient';
import * as UserBankAccount from '../models/UserBankAccount';
import * as FXRateService from '../services/FXRateService';

export async function handleHelp(_context: HandlerContext): Promise<HandlerResult> {
    return {
        nextState: States.IDLE,
        response: `SurgePay Help Menu

${getIdleMenu()}

Reply with any command to begin.`,
        template: 'idle_menu'
    };
}

export async function handleStatus(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const transfers = await Transfer.findByUser(user.id, 5);

    if (transfers.length === 0) {
        return {
            nextState: States.IDLE,
            response: `No transfers yet.

Reply NEW to start your first transfer.`
        };
    }

    let statusMessage = `Recent Transfers

━━━━━━━━━━━━━━━━━━━━\n`;

    for (const transfer of transfers) {
        const recipient = await Recipient.findById(transfer.recipient_id);
        const recipientName = recipient?.nickname || 'Recipient';

        // status icons
        let statusIcon = '⏳';
        if (transfer.status === 'completed') statusIcon = '✓';
        else if (transfer.status === 'cancelled') statusIcon = '✗';
        else if (transfer.status === 'failed') statusIcon = '❌';

        const date = transfer.created_at.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        statusMessage += `
${transfer.transfer_code} ${statusIcon}
${recipientName}: $${transfer.amount_usd.toFixed(2)} → ₹${transfer.amount_inr.toFixed(2)}
Status: ${transfer.status.replace('_', ' ')}
Date: ${date}
━━━━━━━━━━━━━━━━━━━━`;
    }

    statusMessage += `

Type a transfer code for details.`;

    return {
        nextState: States.IDLE,
        response: statusMessage
    };
}

export async function handleRate(_context: HandlerContext): Promise<HandlerResult> {
    const fxResult = await FXRateService.getFXRate();
    const rate = fxResult.rate;

    // calculate example amounts
    const examples = [100, 500, 1000, 2000];
    let examplesText = '';

    for (const amount of examples) {
        const quote = FXRateService.calculateQuote(amount, rate);
        examplesText += `$${amount} → ₹${quote.amountInr.toFixed(2)} (fee: $${quote.feeUsd.toFixed(2)})\n`;
    }

    const sourceLabel = fxResult.source === 'live' ? 'Live rate' :
        fxResult.source === 'cached' ? 'Cached rate' : 'Fallback rate';

    const rateMessage = `Current Exchange Rate

━━━━━━━━━━━━━━━━━━━━
1 USD = ₹${rate.toFixed(4)} INR
━━━━━━━━━━━━━━━━━━━━
${sourceLabel}

Examples (after fee):
${examplesText}
Rate updates every 30 seconds.`;

    return {
        nextState: States.IDLE,
        response: rateMessage,
        template: 'idle_menu'
    };
}

export async function handleFees(_context: HandlerContext): Promise<HandlerResult> {
    const feesMessage = `Fee Structure

━━━━━━━━━━━━━━━━━━━━
Our fee: 0.1% or $2.00
(whichever is lower)
━━━━━━━━━━━━━━━━━━━━

Examples:
• $100 → $0.10 fee (0.1%)
• $500 → $0.50 fee (0.1%)
• $1,000 → $1.00 fee (0.1%)
• $2,000+ → $2.00 fee (max)

No hidden charges.
No receiving fees in India.
What you see is what you pay.`;

    return {
        nextState: States.IDLE,
        response: feesMessage,
        template: 'idle_menu'
    };
}

export async function handleBanks(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const accounts = await UserBankAccount.findByUser(user.id);

    if (accounts.length === 0) {
        return {
            nextState: States.INITIATING_PLAID,
            response: `No bank accounts linked.`,
            template: 'link_bank'
        };
    }

    let banksMessage = `Linked Bank Accounts

━━━━━━━━━━━━━━━━━━━━\n`;

    accounts.forEach((account, index) => {
        const last4 = account.account_number.slice(-4);
        const defaultMark = account.is_default ? ' ⭐ Default' : '';
        const verified = account.verified ? '✓ Verified' : 'Pending';

        banksMessage += `
${index + 1}. ${account.bank_name}
   Account: ****${last4}${defaultMark}
   Status: ${verified}
━━━━━━━━━━━━━━━━━━━━`;
    });

    banksMessage += `

Commands:
• ADD BANK - Link new account
• DEFAULT [#] - Set default account
• REMOVE [#] - Remove account`;

    return {
        nextState: States.IDLE,
        response: banksMessage
    };
}

export async function handleRecipients(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const recipients = await Recipient.findByUser(user.id);

    if (recipients.length === 0) {
        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: `No recipients saved.

Enter a nickname to add your first recipient:
(Example: Mom, Dad, Raj)`
        };
    }

    let recipientsMessage = `Saved Recipients

━━━━━━━━━━━━━━━━━━━━\n`;

    recipients.forEach((recipient, index) => {
        const paymentInfo = recipient.payment_method === 'upi'
            ? `UPI: ${recipient.upi_id}`
            : `Bank: ****${recipient.account_number?.slice(-4)}`;

        recipientsMessage += `
${index + 1}. ${recipient.nickname}
   ${paymentInfo}
   ${recipient.verified ? '✓ Verified' : 'Pending'}
━━━━━━━━━━━━━━━━━━━━`;
    });

    recipientsMessage += `

Reply with a nickname to send money.`;

    return {
        nextState: States.IDLE,
        response: recipientsMessage,
        template: 'add_recipient'
    };
}

export async function handleProfile(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const bankCount = await UserBankAccount.countByUser(user.id);
    const recipients = await Recipient.findByUser(user.id);
    const transfers = await Transfer.findByUser(user.id, 100);

    const completedCount = transfers.filter(t => t.status === 'completed').length;
    const memberSince = user.created_at.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const profileMessage = `Your Profile

━━━━━━━━━━━━━━━━━━━━
${user.full_name}
━━━━━━━━━━━━━━━━━━━━
Email: ${user.email}
Phone: ${user.phone_number}
Address: ${user.address}

━━━━━━━━━━━━━━━━━━━━
Account Stats
━━━━━━━━━━━━━━━━━━━━
Linked Banks: ${bankCount}
Saved Recipients: ${recipients.length}
Completed Transfers: ${completedCount}

━━━━━━━━━━━━━━━━━━━━
KYC Status: ${user.kyc_status === 'verified' ? '✓ Verified' : 'Basic'}
Member Since: ${memberSince}
━━━━━━━━━━━━━━━━━━━━`;

    return {
        nextState: States.IDLE,
        response: profileMessage,
        template: 'idle_menu'
    };
}

export async function handleCancel(_context: HandlerContext): Promise<HandlerResult> {
    return {
        nextState: States.IDLE,
        response: `Action cancelled.

${getIdleMenu()}`,
        data: getClearedSessionData()
    };
}

export async function handleNew(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.INITIAL,
            response: 'Welcome! Let\'s set up your account first. What\'s your full name?'
        };
    }

    return {
        nextState: States.ASKING_RECIPIENT_NAME,
        response: `Starting new transfer.

Who do you want to send money to?

Enter a nickname (existing or new):`,
        data: {
            currentRecipient: undefined,
            transferId: undefined,
            selectedRecipientId: undefined,
            selectedBankAccountId: undefined
        }
    };
}

export async function handleAddBank(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    // check if user already has maximum accounts
    const accountCount = await UserBankAccount.countByUser(user.id);

    if (accountCount >= 5) {
        return {
            nextState: States.IDLE,
            response: `You've reached the maximum of 5 bank accounts.

To add a new one, please remove an existing account first.

Type BANKS to view and manage your accounts.`
        };
    }

    return {
        nextState: States.INITIATING_PLAID,
        response: `Adding a new bank account.

We use Plaid to securely connect to your bank.
Your credentials are never stored by SurgePay.

Reply CONNECT to proceed.`,
        data: { addingBank: true }
    };
}

export async function handleSetDefault(
    context: HandlerContext,
    bankNumber: number
): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const accounts = await UserBankAccount.findByUser(user.id);

    if (bankNumber < 1 || bankNumber > accounts.length) {
        return {
            nextState: States.IDLE,
            response: `Invalid selection. You have ${accounts.length} linked account(s).

Type BANKS to see your accounts.`
        };
    }

    const selectedAccount = accounts[bankNumber - 1];

    if (selectedAccount.is_default) {
        return {
            nextState: States.IDLE,
            response: `${selectedAccount.bank_name} is already your default account.`
        };
    }

    await UserBankAccount.setDefault(selectedAccount.id, user.id);

    const last4 = selectedAccount.account_number.slice(-4);

    return {
        nextState: States.IDLE,
        response: `✓ Default Updated

${selectedAccount.bank_name} (****${last4}) is now your default account.

Future transfers will use this account unless you choose another.`
    };
}

export async function handleRemoveBank(
    context: HandlerContext,
    bankNumber: number
): Promise<HandlerResult> {
    const { user } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    const accounts = await UserBankAccount.findByUser(user.id);

    if (bankNumber < 1 || bankNumber > accounts.length) {
        return {
            nextState: States.IDLE,
            response: `Invalid selection. You have ${accounts.length} linked account(s).

Type BANKS to see your accounts.`
        };
    }

    // cannot remove the only account
    if (accounts.length === 1) {
        return {
            nextState: States.IDLE,
            response: `Cannot remove your only bank account.

Add another account first, then you can remove this one.

Type ADD BANK to link a new account.`
        };
    }

    const accountToRemove = accounts[bankNumber - 1];
    const last4 = accountToRemove.account_number.slice(-4);

    return {
        nextState: States.IDLE,
        response: `Remove ${accountToRemove.bank_name} (****${last4})?

⚠️ This cannot be undone.

Reply CONFIRM REMOVE to proceed.
Reply CANCEL to keep the account.`,
        data: {
            bankToRemove: accountToRemove.id,
            awaitingRemoveConfirm: true
        }
    };
}

export async function handleConfirmRemove(context: HandlerContext): Promise<HandlerResult> {
    const { user, sessionData } = context;

    if (!user) {
        return {
            nextState: States.IDLE,
            response: 'No account found. Type Hi to get started.'
        };
    }

    if (!sessionData.awaitingRemoveConfirm || !sessionData.bankToRemove) {
        return {
            nextState: States.IDLE,
            response: 'No pending removal. Type BANKS to manage your accounts.'
        };
    }

    const accountId = sessionData.bankToRemove;
    const account = await UserBankAccount.findById(accountId);

    if (!account) {
        return {
            nextState: States.IDLE,
            response: 'Account not found. Type BANKS to view your accounts.',
            data: {
                bankToRemove: undefined,
                awaitingRemoveConfirm: undefined
            }
        };
    }

    await UserBankAccount.deactivate(accountId);

    const last4 = account.account_number.slice(-4);
    const remainingCount = await UserBankAccount.countByUser(user.id);

    return {
        nextState: States.IDLE,
        response: `✓ Account Removed

${account.bank_name} (****${last4}) has been removed.

You now have ${remainingCount} linked account(s).`,
        data: {
            bankToRemove: undefined,
            awaitingRemoveConfirm: undefined
        }
    };
}

