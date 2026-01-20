import { PlaidConnectionData } from '../types/session';

interface BankInfo {
    name: string;
    routing: string;
}

const MOCK_BANKS: Record<string, BankInfo> = {
    chase: { name: 'Chase Bank', routing: '021000021' },
    bofa: { name: 'Bank of America', routing: '026009593' },
    wells: { name: 'Wells Fargo', routing: '121000248' }
};

export function parseBankSelection(input: string): string | null {
    const normalized = input.trim().toLowerCase();
    const bankKeys = Object.keys(MOCK_BANKS);

    const num = parseInt(normalized, 10);
    if (!isNaN(num) && num >= 1 && num <= 3) {
        return bankKeys[num - 1];
    }

    // check if input contains bank key or name
    for (const key of bankKeys) {
        const bank = MOCK_BANKS[key];
        if (normalized.includes(key) || normalized.includes(bank.name.toLowerCase())) {
            return key;
        }
    }

    return null;
}

function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateRandomDigits(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}

export async function simulatePlaidConnection(
    bankKey: string,
    userName: string
): Promise<PlaidConnectionData | null> {
    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5% random failure rate
    if (Math.random() < 0.05) {
        return null;
    }

    const bank = MOCK_BANKS[bankKey];
    if (!bank) {
        return null;
    }

    return {
        access_token: 'access-sandbox-' + generateRandomString(16),
        account_id: 'acc-' + generateRandomString(8),
        account_number: generateRandomDigits(10),
        routing_number: bank.routing,
        bank_name: bank.name,
        account_type: 'checking',
        account_holder: userName
    };
}

export function getBankName(bankKey: string): string | null {
    const bank = MOCK_BANKS[bankKey];
    return bank ? bank.name : null;
}
