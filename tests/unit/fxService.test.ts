import { calculateFee, calculateQuote } from '../../src/services/FXRateService';

describe('calculateFee', () => {
    it('calculates 0.1% fee for small amounts', () => {
        const fee = calculateFee(100);
        expect(fee).toBe(0.10);
    });

    it('calculates 0.1% fee for medium amounts', () => {
        const fee = calculateFee(500);
        expect(fee).toBe(0.50);
    });

    it('caps fee at $2 for large amounts', () => {
        const fee = calculateFee(5000);
        expect(fee).toBe(2.00);
    });

    it('caps fee at $2 for maximum amount', () => {
        const fee = calculateFee(10000);
        expect(fee).toBe(2.00);
    });

    it('calculates correctly at threshold ($2000)', () => {
        const fee = calculateFee(2000);
        expect(fee).toBe(2.00);
    });
});

describe('calculateQuote', () => {
    const testRate = 83.50;

    it('calculates quote correctly for small amount', () => {
        const quote = calculateQuote(100, testRate);

        expect(quote.amountUsd).toBe(100);
        expect(quote.feeUsd).toBe(0.10);
        expect(quote.feePercentage).toBe('0.1%');
        expect(quote.fxRate).toBe(83.50);
        expect(quote.amountInr).toBe(8341.65);
    });

    it('calculates quote correctly for large amount', () => {
        const quote = calculateQuote(5000, testRate);

        expect(quote.amountUsd).toBe(5000);
        expect(quote.feeUsd).toBe(2.00);
        expect(quote.feePercentage).toBe('max $2');
        expect(quote.amountInr).toBe(417333.00);
    });

    it('handles decimal fx rates', () => {
        const quote = calculateQuote(100, 83.4567);

        expect(quote.fxRate).toBe(83.4567);
        expect(quote.amountInr).toBeCloseTo(8337.32, 2);
    });

    it('shows 0.1% label when fee is below $2', () => {
        const quote = calculateQuote(1000, testRate);
        expect(quote.feePercentage).toBe('0.1%');
    });

    it('shows max $2 label when fee is capped', () => {
        const quote = calculateQuote(3000, testRate);
        expect(quote.feePercentage).toBe('max $2');
    });
});
