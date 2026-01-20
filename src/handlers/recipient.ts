import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { RecipientFormData } from '../types/session';
import {
    RecipientNameSchema,
    PaymentMethodSchema,
    UPISchema,
    AccountNumberSchema,
    IFSCSchema,
    BankNameSchema,
    ConfirmationSchema
} from '../schemas';
import { getIdleMenu, getClearedSessionData } from './cancelHandler';
import * as Recipient from '../models/Recipient';
import * as MockVerificationService from '../services/MockVerificationService';

export async function handleRecipientName(context: HandlerContext): Promise<HandlerResult> {
    const { message, user } = context;
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
    const result = RecipientNameSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: `Please enter a nickname for this recipient. Example: Mom, Dad, or Raj

Or type CANCEL to abort.`
        };
    }

    const nickname = result.data;

    // check if recipient with this nickname already exists
    if (user) {
        const existingRecipient = await Recipient.findByNickname(user.id, nickname);

        if (existingRecipient) {
            const paymentInfo = existingRecipient.payment_method === 'upi'
                ? existingRecipient.upi_id
                : `****${existingRecipient.account_number?.slice(-4)}`;

            return {
                nextState: States.ASKING_AMOUNT,
                response: `Sending to ${existingRecipient.nickname} (${paymentInfo}).

How much USD do you want to send?

Min: $10 | Max: $10,000`,
                data: { selectedRecipientId: existingRecipient.id }
            };
        }
    }

    // new recipient
    const currentRecipient: RecipientFormData = { nickname };

    return {
        nextState: States.ASKING_PAYMENT_METHOD,
        response: `Adding "${nickname}" as a recipient.`,
        data: { currentRecipient },
        template: 'payment_method'
    };
}

export async function handlePaymentMethod(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient || {};
    const nickname = currentRecipient.nickname || 'recipient';

    if (upperInput === 'CANCEL') {
        return {
            nextState: States.IDLE,
            response: `Action cancelled.

${getIdleMenu()}`,
            data: getClearedSessionData(),
            template: 'idle_menu'
        };
    }

    // validate with zod
    const result = PaymentMethodSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_PAYMENT_METHOD,
            response: `Invalid selection.`,
            template: 'payment_method'
        };
    }

    const choice = result.data;

    if (choice === '1' || choice === 'UPI') {
        return {
            nextState: States.ASKING_UPI_ID,
            response: `Great! UPI transfers are instant.

What's ${nickname}'s UPI ID?

Example: name@paytm, name@ybl, name@okaxis`,
            data: {
                currentRecipient: {
                    ...currentRecipient,
                    payment_method: 'upi'
                }
            }
        };
    }

    // bank account
    return {
        nextState: States.ASKING_ACCOUNT_NUMBER,
        response: `I'll need the bank account details.

What's the account number?`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                payment_method: 'bank'
            }
        }
    };
}

export async function handleUPIId(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient || {};
    const nickname = currentRecipient.nickname || 'recipient';

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
    const result = UPISchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_UPI_ID,
            response: `${result.error.issues[0]?.message || 'Invalid UPI ID.'}

Or type CANCEL to abort.`
        };
    }

    const upiId = result.data.toLowerCase();

    // verify UPI
    const verification = await MockVerificationService.verifyUPI(upiId);

    if (!verification.valid) {
        return {
            nextState: States.ASKING_UPI_ID,
            response: `Could not verify this UPI ID. Please check and try again.

Or type CANCEL to abort.`
        };
    }

    return {
        nextState: States.CONFIRMING_RECIPIENT,
        response: `Verifying UPI ID...

✓ Verified!

━━━━━━━━━━━━━━━━━━━━
Recipient Details
━━━━━━━━━━━━━━━━━━━━
Nickname: ${nickname}
UPI ID: ${upiId}
Verified Name: ${verification.name}
━━━━━━━━━━━━━━━━━━━━`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                upi_id: upiId,
                verification_name: verification.name
            }
        },
        template: 'yes_no'
    };
}

export async function handleAccountNumber(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient || {};

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
    const result = AccountNumberSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_ACCOUNT_NUMBER,
            response: `${result.error.issues[0]?.message || 'Invalid account number.'}

Or type CANCEL to abort.`
        };
    }

    const accountNumber = result.data;

    return {
        nextState: States.ASKING_IFSC,
        response: `Got it. ✓

What's the IFSC code?

Example: SBIN0001234, HDFC0001234`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                account_number: accountNumber
            }
        }
    };
}

export async function handleIFSC(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient || {};

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
    const result = IFSCSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_IFSC,
            response: `${result.error.issues[0]?.message || 'Invalid IFSC code.'}

Or type CANCEL to abort.`
        };
    }

    const ifsc = result.data;

    return {
        nextState: States.ASKING_BANK_NAME,
        response: `Got it. ✓

What's the bank name?

Example: State Bank of India, HDFC Bank`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                ifsc_code: ifsc
            }
        }
    };
}

export async function handleBankName(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient || {};
    const nickname = currentRecipient.nickname || 'recipient';
    const accountNumber = currentRecipient.account_number || '';
    const ifscCode = currentRecipient.ifsc_code || '';

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
    const result = BankNameSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_BANK_NAME,
            response: `${result.error.issues[0]?.message || 'Please enter a valid bank name.'}

Or type CANCEL to abort.`
        };
    }

    const bankName = result.data;

    // verify bank account
    const verification = await MockVerificationService.verifyBank(accountNumber, ifscCode);

    if (!verification.valid) {
        return {
            nextState: States.ASKING_ACCOUNT_NUMBER,
            response: `Could not verify this account. Please check the details and try again.

Or type CANCEL to abort.`
        };
    }

    const maskedAccount = '****' + accountNumber.slice(-4);

    return {
        nextState: States.CONFIRMING_RECIPIENT,
        response: `Verifying bank account...

✓ Verified!

━━━━━━━━━━━━━━━━━━━━
Recipient Details
━━━━━━━━━━━━━━━━━━━━
Nickname: ${nickname}
Account: ${maskedAccount}
IFSC: ${ifscCode}
Bank: ${bankName}
Holder: ${verification.name}
━━━━━━━━━━━━━━━━━━━━`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                bank_name: bankName,
                verification_name: verification.name
            }
        },
        template: 'yes_no'
    };
}

export async function handleConfirmingRecipient(context: HandlerContext): Promise<HandlerResult> {
    const { message, user, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();
    const currentRecipient = sessionData.currentRecipient;

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
    const result = ConfirmationSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.CONFIRMING_RECIPIENT,
            response: `Invalid response.`,
            template: 'yes_no'
        };
    }

    const command = result.data;

    if (command === 'YES') {
        if (!currentRecipient) {
            return {
                nextState: States.ASKING_RECIPIENT_NAME,
                response: 'Session expired. Please enter the recipient nickname again.'
            };
        }

        if (!user) {
            return {
                nextState: States.INITIAL,
                response: 'Something went wrong. Please type Hi to start over.'
            };
        }

        const recipientData = {
            user_id: user.id,
            nickname: currentRecipient.nickname || 'Recipient',
            payment_method: currentRecipient.payment_method || 'upi',
            upi_id: currentRecipient.upi_id,
            account_number: currentRecipient.account_number,
            ifsc_code: currentRecipient.ifsc_code,
            bank_name: currentRecipient.bank_name,
            verified: true,
            verification_name: currentRecipient.verification_name
        };

        const recipient = await Recipient.create(recipientData);

        const paymentInfo = recipient.payment_method === 'upi'
            ? recipient.upi_id
            : `****${recipient.account_number?.slice(-4)} (${recipient.bank_name})`;

        return {
            nextState: States.ASKING_AMOUNT,
            response: `✓ Recipient saved!

━━━━━━━━━━━━━━━━━━━━
${recipient.nickname}
${paymentInfo}
━━━━━━━━━━━━━━━━━━━━

How much USD do you want to send?

Min: $10 | Max: $10,000`,
            data: {
                currentRecipient: undefined,
                selectedRecipientId: recipient.id
            }
        };
    }

    // no - go back to re-enter details
    if (!currentRecipient) {
        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: 'Please enter the recipient nickname again.'
        };
    }

    if (currentRecipient.payment_method === 'upi') {
        return {
            nextState: States.ASKING_UPI_ID,
            response: `Let's try again.

What's the correct UPI ID?`,
            data: {
                currentRecipient: {
                    ...currentRecipient,
                    upi_id: undefined,
                    verification_name: undefined
                }
            }
        };
    }

    return {
        nextState: States.ASKING_ACCOUNT_NUMBER,
        response: `Let's try again.

What's the correct account number?`,
        data: {
            currentRecipient: {
                ...currentRecipient,
                account_number: undefined,
                ifsc_code: undefined,
                bank_name: undefined,
                verification_name: undefined
            }
        }
    };
}
