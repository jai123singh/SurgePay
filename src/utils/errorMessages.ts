// user-friendly error messages that don't expose technical details

export const ErrorMessages = {
    DATABASE_ERROR: 'Temporary issue. Your data is safe. Try again.',
    REDIS_ERROR: 'Temporary issue. Please try again.',
    FX_API_ERROR: 'Using cached rate. May differ slightly.',
    TWILIO_ERROR: 'Message delivery delayed.',
    SESSION_EXPIRED: 'Session expired. Type Hi to start over.',
    GENERAL_ERROR: 'Something went wrong. Please try again.',
    TRANSFER_NOT_FOUND: 'Transfer not found. Check the code.',
    RECIPIENT_NOT_FOUND: 'Recipient not found.',
    BANK_NOT_FOUND: 'Bank account not found.',
    UNAUTHORIZED: 'Please complete setup first.'
} as const;
