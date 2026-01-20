import { HandlerContext, HandlerResult } from '../types/handler';
import { States } from '../constants/states';
import { NameSchema, EmailSchema, DOBSchema, AddressSchema } from '../schemas';
import { getIdleMenu, getClearedSessionData } from './cancelHandler';

export async function handleInitial(context: HandlerContext): Promise<HandlerResult> {
    const { user } = context;

    if (user) {
        return {
            nextState: States.IDLE,
            response: `Welcome back, ${user.full_name}! 👋

${getIdleMenu()}`,
            template: 'idle_menu'
        };
    }

    // new user - start onboarding
    return {
        nextState: States.ASKING_NAME,
        response: `Welcome to SurgePay! 🇺🇸 → 🇮🇳

Send money from the US to India instantly via WhatsApp.

━━━━━━━━━━━━━━━━━━━━
What we offer:
━━━━━━━━━━━━━━━━━━━━
• Live exchange rates
• Save recipients
• Instant transfers
• Real-time tracking

Let's set up your account (takes 2 minutes).

What's your full name?`
    };
}

export async function handleName(context: HandlerContext): Promise<HandlerResult> {
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
    const result = NameSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_NAME,
            response: `${result.error.issues[0]?.message || 'Please enter your name.'}

Or type CANCEL to abort.`
        };
    }

    const name = result.data;

    return {
        nextState: States.ASKING_EMAIL,
        response: `Nice to meet you, ${name}! 👋

What's your email address?`,
        data: { name }
    };
}

export async function handleEmail(context: HandlerContext): Promise<HandlerResult> {
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
    const result = EmailSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_EMAIL,
            response: `${result.error.issues[0]?.message || 'Please enter a valid email address.'}

Or type CANCEL to abort.`
        };
    }

    const email = result.data.toLowerCase();

    return {
        nextState: States.ASKING_DOB,
        response: `Got it! ✓

What's your date of birth?

Please use DD/MM/YYYY format.
Example: 15/08/1990`,
        data: { email }
    };
}

export async function handleDOB(context: HandlerContext): Promise<HandlerResult> {
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
    const result = DOBSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_DOB,
            response: `${result.error.issues[0]?.message || 'Please enter a valid date of birth.'}

Or type CANCEL to abort.`
        };
    }

    const dob = result.data;

    return {
        nextState: States.ASKING_ADDRESS,
        response: `Thanks! ✓

What's your address?

Please include city, state, and country.
Example: New York, NY, USA`,
        data: { dob }
    };
}

export async function handleAddress(context: HandlerContext): Promise<HandlerResult> {
    const { message, sessionData } = context;
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
    const result = AddressSchema.safeParse(input);

    if (!result.success) {
        return {
            nextState: States.ASKING_ADDRESS,
            response: `${result.error.issues[0]?.message || 'Please enter a valid address.'}

Or type CANCEL to abort.`
        };
    }

    const address = result.data;
    const { name, email, dob } = sessionData;

    return {
        nextState: States.INITIATING_PLAID,
        response: `Profile Summary
━━━━━━━━━━━━━━━━━━━━
Name: ${name}
Email: ${email}
DOB: ${dob}
Address: ${address}
━━━━━━━━━━━━━━━━━━━━

Next, let's link your US bank account.

We use Plaid for secure bank connections.
Trusted by Venmo, Coinbase, and Cash App.

Your credentials are encrypted and
never stored on our servers.`,
        data: { address },
        template: 'link_bank'
    };
}
