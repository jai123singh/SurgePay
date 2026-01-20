const MOCK_NAMES = [
    'Smt. Sunita Singh',
    'Shri Rajesh Kumar',
    'Ms. Priya Sharma',
    'Mr. Amit Patel',
    'Mrs. Kavitha Reddy'
];

export interface VerificationResult {
    valid: boolean;
    name: string;
}

function getRandomName(): string {
    const index = Math.floor(Math.random() * MOCK_NAMES.length);
    return MOCK_NAMES[index];
}

export async function verifyUPI(_upiId: string): Promise<VerificationResult> {
    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // for demo, always return valid with random name
    // in production, this would call actual UPI verification API
    return {
        valid: true,
        name: getRandomName()
    };
}

export async function verifyBank(
    _accountNumber: string,
    _ifsc: string
): Promise<VerificationResult> {
    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // for demo, always return valid with random name
    // in production, this would call bank verification API (penny drop)
    return {
        valid: true,
        name: getRandomName()
    };
}
