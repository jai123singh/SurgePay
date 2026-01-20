export function generateTransferCode(): string {
    // generate 4 random digits between 1000 and 9999
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `TX${digits}`;
}
