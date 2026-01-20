export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export interface DateValidationResult extends ValidationResult {
    parsedDate?: Date;
}

export interface AmountValidationResult extends ValidationResult {
    amount?: number;
}

export function validateName(name: string): ValidationResult {
    const trimmed = name.trim();

    if (trimmed.length < 1) {
        return { valid: false, error: 'Please enter your name.' };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'Name must be under 100 characters.' };
    }

    return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Please enter a valid email address.' };
    }

    return { valid: true };
}

export function validateDateOfBirth(dobString: string): DateValidationResult {
    const trimmed = dobString.trim();
    const parts = trimmed.split('/');

    if (parts.length !== 3) {
        return { valid: false, error: 'Please use DD/MM/YYYY format. Example: 15/08/1990' };
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return { valid: false, error: 'Invalid date. Please use DD/MM/YYYY format.' };
    }

    const date = new Date(year, month, day);

    // verify the date is valid (handles cases like 31/02/2000)
    if (
        date.getDate() !== day ||
        date.getMonth() !== month ||
        date.getFullYear() !== year
    ) {
        return { valid: false, error: 'Invalid date. Please check day and month.' };
    }

    // calculate age
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
    }

    if (age < 18) {
        return { valid: false, error: 'You must be at least 18 years old.' };
    }

    if (age > 120) {
        return { valid: false, error: 'Please enter a valid date of birth.' };
    }

    return { valid: true, parsedDate: date };
}

export function validateAmount(amountStr: string): AmountValidationResult {
    // remove $ and , characters
    const cleaned = amountStr.replace(/[$,]/g, '').trim();
    const amount = parseFloat(cleaned);

    if (isNaN(amount)) {
        return { valid: false, error: 'Please enter a valid number.' };
    }

    if (amount < 10) {
        return { valid: false, error: 'Minimum amount is $10.' };
    }

    if (amount > 10000) {
        return { valid: false, error: 'Maximum amount is $10,000.' };
    }

    return { valid: true, amount };
}

export function validateUPIId(upiId: string): ValidationResult {
    const trimmed = upiId.trim().toLowerCase();

    if (!trimmed.includes('@')) {
        return { valid: false, error: 'UPI ID must contain @. Example: name@paytm' };
    }

    if (trimmed.length < 5) {
        return { valid: false, error: 'UPI ID is too short.' };
    }

    return { valid: true };
}

export function validateIFSC(ifsc: string): ValidationResult {
    const trimmed = ifsc.trim().toUpperCase();

    // ifsc format: 4 letters + 0 + 6 alphanumeric
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    if (!ifscRegex.test(trimmed)) {
        return { valid: false, error: 'Invalid IFSC code. Example: SBIN0001234' };
    }

    return { valid: true };
}

export function validateAccountNumber(accountNumber: string): ValidationResult {
    const cleaned = accountNumber.replace(/\s/g, '');

    if (!/^\d+$/.test(cleaned)) {
        return { valid: false, error: 'Account number must contain only digits.' };
    }

    if (cleaned.length < 9 || cleaned.length > 18) {
        return { valid: false, error: 'Account number must be 9-18 digits.' };
    }

    return { valid: true };
}
