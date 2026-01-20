import {
    AmountSchema,
    UPISchema,
    IFSCSchema,
    DOBSchema,
    EmailSchema,
    ConfirmationSchema,
    PaymentMethodSchema
} from '../../src/schemas';

describe('AmountSchema', () => {
    it('accepts valid amount within range', () => {
        const result = AmountSchema.safeParse('100');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe(100);
        }
    });

    it('accepts amount with dollar sign', () => {
        const result = AmountSchema.safeParse('$500');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe(500);
        }
    });

    it('accepts amount with comma', () => {
        const result = AmountSchema.safeParse('1,000');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe(1000);
        }
    });

    it('rejects amount below minimum', () => {
        const result = AmountSchema.safeParse('5');
        expect(result.success).toBe(false);
    });

    it('rejects amount above maximum', () => {
        const result = AmountSchema.safeParse('15000');
        expect(result.success).toBe(false);
    });

    it('rejects non-numeric input', () => {
        const result = AmountSchema.safeParse('abc');
        expect(result.success).toBe(false);
    });

    it('rejects more than 2 decimal places', () => {
        const result = AmountSchema.safeParse('100.999');
        expect(result.success).toBe(false);
    });
});

describe('UPISchema', () => {
    it('accepts valid upi id', () => {
        const result = UPISchema.safeParse('name@paytm');
        expect(result.success).toBe(true);
    });

    it('accepts upi with bank handle', () => {
        const result = UPISchema.safeParse('user123@okaxis');
        expect(result.success).toBe(true);
    });

    it('rejects upi without @ symbol', () => {
        const result = UPISchema.safeParse('namepaytm');
        expect(result.success).toBe(false);
    });

    it('rejects too short upi id', () => {
        const result = UPISchema.safeParse('a@b');
        expect(result.success).toBe(false);
    });
});

describe('IFSCSchema', () => {
    it('accepts valid ifsc code', () => {
        const result = IFSCSchema.safeParse('SBIN0001234');
        expect(result.success).toBe(true);
    });

    it('transforms to uppercase', () => {
        const result = IFSCSchema.safeParse('hdfc0001234');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe('HDFC0001234');
        }
    });

    it('rejects invalid ifsc format', () => {
        const result = IFSCSchema.safeParse('INVALID');
        expect(result.success).toBe(false);
    });

    it('rejects ifsc without zero in 5th position', () => {
        const result = IFSCSchema.safeParse('SBIN1001234');
        expect(result.success).toBe(false);
    });
});

describe('DOBSchema', () => {
    it('accepts valid date of birth', () => {
        const result = DOBSchema.safeParse('15/08/1990');
        expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
        const result = DOBSchema.safeParse('1990-08-15');
        expect(result.success).toBe(false);
    });

    it('rejects impossible date', () => {
        const result = DOBSchema.safeParse('31/02/1990');
        expect(result.success).toBe(false);
    });

    it('rejects underage user', () => {
        const currentYear = new Date().getFullYear();
        const result = DOBSchema.safeParse(`01/01/${currentYear - 10}`);
        expect(result.success).toBe(false);
    });
});

describe('EmailSchema', () => {
    it('accepts valid email', () => {
        const result = EmailSchema.safeParse('user@example.com');
        expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
        const result = EmailSchema.safeParse('notanemail');
        expect(result.success).toBe(false);
    });
});

describe('ConfirmationSchema', () => {
    it('accepts yes', () => {
        const result = ConfirmationSchema.safeParse('yes');
        expect(result.success).toBe(true);
    });

    it('accepts no', () => {
        const result = ConfirmationSchema.safeParse('NO');
        expect(result.success).toBe(true);
    });

    it('rejects other input', () => {
        const result = ConfirmationSchema.safeParse('maybe');
        expect(result.success).toBe(false);
    });
});

describe('PaymentMethodSchema', () => {
    it('accepts 1 for upi', () => {
        const result = PaymentMethodSchema.safeParse('1');
        expect(result.success).toBe(true);
    });

    it('accepts 2 for bank', () => {
        const result = PaymentMethodSchema.safeParse('2');
        expect(result.success).toBe(true);
    });

    it('accepts upi text', () => {
        const result = PaymentMethodSchema.safeParse('upi');
        expect(result.success).toBe(true);
    });

    it('rejects invalid option', () => {
        const result = PaymentMethodSchema.safeParse('3');
        expect(result.success).toBe(false);
    });
});
