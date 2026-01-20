import { generateTransferCode } from '../../src/utils/transferCodeGenerator';

describe('generateTransferCode', () => {
    it('generates code with TX prefix', () => {
        const code = generateTransferCode();
        expect(code.startsWith('TX')).toBe(true);
    });

    it('generates code of correct length', () => {
        const code = generateTransferCode();
        expect(code.length).toBe(6);
    });

    it('generates code with 4 digits after TX', () => {
        const code = generateTransferCode();
        const digits = code.substring(2);
        expect(/^\d{4}$/.test(digits)).toBe(true);
    });

    it('generates digits in valid range (1000-9999)', () => {
        for (let i = 0; i < 100; i++) {
            const code = generateTransferCode();
            const num = parseInt(code.substring(2), 10);
            expect(num).toBeGreaterThanOrEqual(1000);
            expect(num).toBeLessThan(10000);
        }
    });

    it('generates unique codes', () => {
        const codes = new Set<string>();
        for (let i = 0; i < 50; i++) {
            codes.add(generateTransferCode());
        }
        expect(codes.size).toBeGreaterThan(45);
    });
});
