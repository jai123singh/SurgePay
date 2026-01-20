import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { PlaidInitSchema, ConfirmationSchema } from '../schemas';
import { getIdleMenu, getClearedSessionData } from './cancelHandler';
import * as PlaidMockService from '../services/PlaidMockService';
import * as User from '../models/User';
import * as UserBankAccount from '../models/UserBankAccount';

export async function handleInitiatingPlaid(context: HandlerContext): Promise<HandlerResult> {
    const { message } = context;
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
    const result = PlaidInitSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.INITIATING_PLAID,
            response: '',
            template: 'link_bank'
        };
    }

    return {
        nextState: States.SELECTING_BANK,
        response: '',
        template: 'bank_selection'
    };
}

export async function handleSelectingBank(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
    const input = message.trim();
    const upperInput = input.toUpperCase();

    if (upperInput === 'CANCEL') {
        return {
            nextState: States.IDLE,
            response: `Action cancelled.

${getIdleMenu()}`,
            data: getClearedSessionData(),
            template: 'idle_menu'
        };
    }

    if (upperInput === 'RETRY') {
        return {
            nextState: States.SELECTING_BANK,
            response: '',
            template: 'bank_selection'
        };
    }

    // try to parse bank selection by number or name
    const bankKey = PlaidMockService.parseBankSelection(input);

    if (!bankKey) {
        return {
            nextState: States.SELECTING_BANK,
            response: `Invalid selection.`,
            template: 'bank_selection'
        };
    }

    const userName = sessionData.name || 'User';
    const plaidData = await PlaidMockService.simulatePlaidConnection(bankKey, userName);

    if (!plaidData) {
        return {
            nextState: States.SELECTING_BANK,
            response: `Connection failed. Please try again.`,
            template: 'bank_selection'
        };
    }

    const last4 = plaidData.account_number.slice(-4);

    return {
        nextState: States.CONFIRMING_PLAID_BANK,
        response: `Connecting to ${plaidData.bank_name}...

▓▓▓▓▓▓▓▓▓▓ 100%

✓ Connection successful!

━━━━━━━━━━━━━━━━━━━━
Account Details
━━━━━━━━━━━━━━━━━━━━
Bank: ${plaidData.bank_name}
Account: ****${last4}
Type: ${plaidData.account_type}
Routing: ${plaidData.routing_number}
Holder: ${plaidData.account_holder}
━━━━━━━━━━━━━━━━━━━━`,
        data: { plaidData, bankKey },
        template: 'yes_no'
    };
}

export async function handleConfirmingPlaidBank(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData, phoneNumber } = context;
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
    const result = ConfirmationSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.CONFIRMING_PLAID_BANK,
            response: `Invalid response.`,
            template: 'yes_no'
        };
    }

    const command = result.data;

    if (command === 'YES') {
        const plaidData = sessionData.plaidData;

        if (!plaidData) {
            return {
                nextState: States.SELECTING_BANK,
                response: `Session expired. Please select your bank again.`,
                template: 'bank_selection'
            };
        }

        // check if this is adding additional bank
        if (sessionData.addingBank) {
            const user = await User.findByPhone(phoneNumber);

            if (!user) {
                return {
                    nextState: States.INITIAL,
                    response: 'Something went wrong. Please type Hi to start over.'
                };
            }

            await UserBankAccount.create({
                user_id: user.id,
                plaid_access_token: plaidData.access_token,
                plaid_account_id: plaidData.account_id,
                account_number: plaidData.account_number,
                routing_number: plaidData.routing_number,
                bank_name: plaidData.bank_name,
                account_holder_name: plaidData.account_holder,
                account_type: 'checking',
                is_default: false
            });

            const last4 = plaidData.account_number.slice(-4);

            return {
                nextState: States.IDLE,
                response: `✓ Bank account added!

${plaidData.bank_name} (****${last4}) has been linked.

${getIdleMenu()}`,
                data: { plaidData: undefined, bankKey: undefined, addingBank: undefined }
            };
        }

        // first-time setup
        const { name, email, dob, address } = sessionData;

        if (!name || !email || !dob || !address) {
            return {
                nextState: States.INITIAL,
                response: 'Missing profile information. Please type Hi to start over.'
            };
        }

        const dobParts = dob.split('/');
        const dobFormatted = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;

        const user = await User.create({
            phone_number: phoneNumber,
            full_name: name,
            email: email,
            date_of_birth: dobFormatted,
            address: address
        });

        await UserBankAccount.create({
            user_id: user.id,
            plaid_access_token: plaidData.access_token,
            plaid_account_id: plaidData.account_id,
            account_number: plaidData.account_number,
            routing_number: plaidData.routing_number,
            bank_name: plaidData.bank_name,
            account_holder_name: plaidData.account_holder,
            account_type: 'checking',
            is_default: true
        });

        const last4 = plaidData.account_number.slice(-4);

        return {
            nextState: States.ASKING_RECIPIENT_NAME,
            response: `✓ Bank account linked!

━━━━━━━━━━━━━━━━━━━━
Account Setup Complete
━━━━━━━━━━━━━━━━━━━━
Name: ${name}
Bank: ${plaidData.bank_name}
Account: ****${last4}
Status: Verified via Plaid
━━━━━━━━━━━━━━━━━━━━

Now, who do you want to send money to?

Enter a nickname for this recipient:
(Example: Mom, Dad, Raj)`,
            data: { plaidData: undefined, bankKey: undefined }
        };
    }

    // no - go back to bank selection
    return {
        nextState: States.SELECTING_BANK,
        response: `No problem. Let's try again.`,
        data: { plaidData: undefined, bankKey: undefined },
        template: 'bank_selection'
    };
}
