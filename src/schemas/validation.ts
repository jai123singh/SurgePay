import { z } from 'zod';

// name validation: 1-100 characters
export const NameSchema = z.string()
    .min(1, 'Please enter your name.')
    .max(100, 'Name must be under 100 characters.');

// email validation: standard email format
export const EmailSchema = z.string()
    .email('Please enter a valid email address.');

// date of birth validation: DD/MM/YYYY format, age 18-120
export const DOBSchema = z.string()
    .regex(
        /^\d{2}\/\d{2}\/\d{4}$/,
        'Please use DD/MM/YYYY format. Example: 15/08/1990'
    )
    .refine((val: string) => {
        const parts = val.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        const date = new Date(year, month, day);

        // check if date is valid (handles cases like 31/02/2000)
        return (
            date.getDate() === day &&
            date.getMonth() === month &&
            date.getFullYear() === year
        );
    }, 'Invalid date. Please check day and month.')
    .refine((val: string) => {
        const parts = val.split('/');
        const year = parseInt(parts[2], 10);
        const today = new Date();
        const age = today.getFullYear() - year;

        return age >= 18;
    }, 'You must be at least 18 years old.')
    .refine((val: string) => {
        const parts = val.split('/');
        const year = parseInt(parts[2], 10);
        const today = new Date();
        const age = today.getFullYear() - year;

        return age <= 120;
    }, 'Please enter a valid date of birth.');

// address validation: minimum 5 characters
export const AddressSchema = z.string()
    .min(5, 'Please enter address with city, state, and country.');

// amount validation: positive, $10-$10,000, max 2 decimals
export const AmountSchema = z.string()
    .transform((val: string) => val.replace(/[$,]/g, '').trim())
    .refine((val: string) => !isNaN(parseFloat(val)), 'Please enter a valid number.')
    .transform((val: string) => parseFloat(val))
    .refine((val: number) => val > 0, 'Amount must be positive.')
    .refine((val: number) => val >= 10, 'Minimum amount is $10.')
    .refine((val: number) => val <= 10000, 'Maximum amount is $10,000.')
    .refine((val: number) => {
        const decimals = (val.toString().split('.')[1] || '').length;
        return decimals <= 2;
    }, 'Maximum 2 decimal places allowed.');

// upi id validation: min 5 chars, must contain @
export const UPISchema = z.string()
    .min(5, 'UPI ID is too short.')
    .refine((val: string) => val.includes('@'), 'UPI ID must contain @. Example: name@paytm');

// ifsc code validation: 4 letters + 0 + 6 alphanumeric
export const IFSCSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val),
        'Invalid IFSC code. Example: SBIN0001234'
    );

// account number validation: 9-18 digits only
export const AccountNumberSchema = z.string()
    .transform((val: string) => val.replace(/\s/g, ''))
    .refine((val: string) => /^\d+$/.test(val), 'Account number must contain only digits.')
    .refine(
        (val: string) => val.length >= 9 && val.length <= 18,
        'Account number must be 9-18 digits.'
    );

// bank selection validation: 1-4 only
export const BankSelectionSchema = z.string()
    .transform((val: string) => val.trim())
    .refine(
        (val: string) => ['1', '2', '3', '4'].includes(val),
        'Invalid selection. Reply 1-4 to select bank.'
    );

// yes/no confirmation
export const ConfirmationSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => val === 'YES' || val === 'NO',
        'Reply YES or NO.'
    );

// quote action: confirm or cancel
export const QuoteActionSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => val === 'CONFIRM' || val === 'CANCEL',
        'Reply CONFIRM or CANCEL.'
    );

// pay action: pay or cancel
export const PayActionSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => val === 'PAY' || val === 'CANCEL',
        'Reply PAY or CANCEL.'
    );

// payment method: 1, 2, UPI, BANK, or BANK_ACCOUNT (from button)
export const PaymentMethodSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => ['1', '2', 'UPI', 'BANK', 'BANK_ACCOUNT'].includes(val),
        'Reply 1 for UPI or 2 for Bank.'
    );

// bank name: minimum 2 characters
export const BankNameSchema = z.string()
    .min(2, 'Please enter a valid bank name.');

// recipient nickname: minimum 1 character
export const RecipientNameSchema = z.string()
    .min(1, 'Please enter a nickname for this recipient.');

// plaid initiation: accepts LINK BANK, LINK, CONNECT, or 1
export const PlaidInitSchema = z.string()
    .transform((val: string) => val.toUpperCase().trim())
    .refine(
        (val: string) => ['LINK BANK', 'LINK', 'CONNECT', '1'].includes(val),
        'Please type LINK BANK to connect your bank account.'
    );
