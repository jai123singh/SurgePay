import { parseBankSelection, getBankName } from '../../src/services/PlaidMockService';

describe('parseBankSelection', () => {
    it('parses numeric selection 1 as chase', () => {
        const result = parseBankSelection('1');
        expect(result).toBe('chase');
    });

    it('parses numeric selection 2 as bofa', () => {
        const result = parseBankSelection('2');
        expect(result).toBe('bofa');
    });

    it('parses numeric selection 3 as wells', () => {
        const result = parseBankSelection('3');
        expect(result).toBe('wells');
    });

    it('parses bank key directly', () => {
        const result = parseBankSelection('chase');
        expect(result).toBe('chase');
    });

    it('parses bank name case-insensitively', () => {
        const result = parseBankSelection('Chase Bank');
        expect(result).toBe('chase');
    });

    it('parses partial bank name', () => {
        const result = parseBankSelection('wells fargo');
        expect(result).toBe('wells');
    });

    it('returns null for invalid selection', () => {
        const result = parseBankSelection('invalid');
        expect(result).toBeNull();
    });

    it('returns null for out of range number', () => {
        const result = parseBankSelection('5');
        expect(result).toBeNull();
    });

    it('handles whitespace', () => {
        const result = parseBankSelection('  1  ');
        expect(result).toBe('chase');
    });
});

describe('getBankName', () => {
    it('returns bank name for valid key', () => {
        expect(getBankName('chase')).toBe('Chase Bank');
        expect(getBankName('bofa')).toBe('Bank of America');
        expect(getBankName('wells')).toBe('Wells Fargo');
    });

    it('returns null for invalid key', () => {
        expect(getBankName('invalid')).toBeNull();
    });
});
