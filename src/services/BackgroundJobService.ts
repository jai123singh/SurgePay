import * as TwilioService from './TwilioService';
import * as Transfer from '../models/Transfer';
import * as logger from '../utils/logger';

export interface TransferJobData {
    transfer_code: string;
    amount_usd: number;
    amount_inr: number;
    fee_usd: number;
    bank_name: string;
    bank_last4: string;
    recipient_name: string;
    payment_type: string;
    payment_details: string;
}

// track active jobs so we can cancel them on shutdown
const activeJobs = new Map<string, NodeJS.Timeout[]>();

export function startStatusNotificationJob(
    transferId: string,
    phoneNumber: string,
    data: TransferJobData,
    onComplete?: () => Promise<void>
): void {
    const timeouts: NodeJS.Timeout[] = [];

    // step 1: withdrawal initiated (5 seconds)
    const timeout1 = setTimeout(async () => {
        try {
            const message = `Withdrawal initiated!

━━━━━━━━━━━━━━━━━━━━
Transfer ${data.transfer_code}
━━━━━━━━━━━━━━━━━━━━

Step 1/2: Processing
Withdrawing $${data.amount_usd.toFixed(2)} from ${data.bank_name}...

This usually takes a few seconds.`;

            await TwilioService.sendWhatsAppMessage(phoneNumber, message);
            logger.info('sent withdrawal initiated message', { transferId, code: data.transfer_code });
        } catch (error) {
            logger.error('failed to send withdrawal initiated message', { transferId, error });
        }
    }, 5000);
    timeouts.push(timeout1);

    // step 2: withdrawal complete, payout started (15 seconds)
    const timeout2 = setTimeout(async () => {
        try {
            // update transfer status
            await Transfer.updateStatus(transferId, 'processing_payout', 'withdrawal_completed_at');
            await Transfer.updateTimestamp(transferId, 'payout_initiated_at');

            const message = `Withdrawal successful!

━━━━━━━━━━━━━━━━━━━━
Transfer ${data.transfer_code}
━━━━━━━━━━━━━━━━━━━━

Step 1/2: Complete ✓
$${data.amount_usd.toFixed(2)} withdrawn from ${data.bank_name}.

Step 2/2: Sending ₹${data.amount_inr.toFixed(2)} to ${data.recipient_name}...`;

            await TwilioService.sendWhatsAppMessage(phoneNumber, message);
            logger.info('sent withdrawal complete message', { transferId, code: data.transfer_code });
        } catch (error) {
            logger.error('failed to send withdrawal complete message', { transferId, error });
        }
    }, 15000);
    timeouts.push(timeout2);

    // step 3: payout in progress (20 seconds)
    const timeout3 = setTimeout(async () => {
        try {
            const message = `Payout initiated!

━━━━━━━━━━━━━━━━━━━━
Transfer ${data.transfer_code}
━━━━━━━━━━━━━━━━━━━━

Step 2/2: Processing
Sending ₹${data.amount_inr.toFixed(2)} to ${data.recipient_name}'s ${data.payment_type}...

${data.payment_details}`;

            await TwilioService.sendWhatsAppMessage(phoneNumber, message);
            logger.info('sent payout initiated message', { transferId, code: data.transfer_code });
        } catch (error) {
            logger.error('failed to send payout initiated message', { transferId, error });
        }
    }, 20000);
    timeouts.push(timeout3);

    // step 4: complete (30 seconds)
    const timeout4 = setTimeout(async () => {
        try {
            // update transfer status to completed
            await Transfer.updateStatus(transferId, 'completed', 'payout_completed_at');

            const completedAt = new Date().toLocaleString('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const message = `✓ Transfer Complete!

━━━━━━━━━━━━━━━━━━━━
Transfer ${data.transfer_code}
━━━━━━━━━━━━━━━━━━━━

Step 1/2: Withdrawal ✓
Step 2/2: Payout ✓

━━━━━━━━━━━━━━━━━━━━
Amount Sent: $${data.amount_usd.toFixed(2)}
Fee: $${data.fee_usd.toFixed(2)}
${data.recipient_name} received: ₹${data.amount_inr.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━

Completed: ${completedAt} EST`;

            await TwilioService.sendWhatsAppMessage(phoneNumber, message, 'idle_menu');
            logger.info('sent transfer complete message', { transferId, code: data.transfer_code });

            // clean up this job from active jobs
            activeJobs.delete(transferId);

            // call completion callback to clear processing flag
            if (onComplete) {
                await onComplete();
            }
        } catch (error) {
            logger.error('failed to send transfer complete message', { transferId, error });
        }
    }, 30000);
    timeouts.push(timeout4);

    // store all timeout references for this transfer
    activeJobs.set(transferId, timeouts);
    logger.info('started status notification job', { transferId, code: data.transfer_code });
}

export function cancelJob(transferId: string): void {
    const timeouts = activeJobs.get(transferId);

    if (timeouts) {
        timeouts.forEach(timeout => clearTimeout(timeout));
        activeJobs.delete(transferId);
        logger.info('cancelled job', { transferId });
    }
}

export function cancelAllJobs(): void {
    let count = 0;

    activeJobs.forEach((timeouts, _transferId) => {
        timeouts.forEach(timeout => clearTimeout(timeout));
        count++;
    });

    activeJobs.clear();
    logger.info('cancelled all jobs', { count });
}

export function getActiveJobCount(): number {
    return activeJobs.size;
}

const fxUpdateJobs = new Map<string, NodeJS.Timeout>();

export interface FXUpdateJobData {
    recipientName: string;
    amountUsd: number;
    transferCode: string;
}

export function startFXUpdateJob(
    phoneNumber: string,
    transferId: string,
    data: FXUpdateJobData,
    onError: () => Promise<void>
): string {
    const jobId = `fx_${transferId}_${Date.now()}`;
    const FXRateService = require('./FXRateService');
    const Transfer = require('../models/Transfer').default || require('../models/Transfer');
    const SessionService = require('./SessionService');
    const { States } = require('../constants/states');

    const interval = setInterval(async () => {
        try {
            // check if session is still in SHOWING_QUOTE
            const session = await SessionService.getSession(phoneNumber);
            if (!session || session.state !== States.SHOWING_QUOTE) {
                stopFXUpdateJob(jobId);
                return;
            }

            // check if transfer still in quote status
            const transfer = await Transfer.findById(transferId);
            if (!transfer || transfer.status !== 'quote') {
                stopFXUpdateJob(jobId);
                return;
            }

            // check if quote expired (5 minutes)
            if (transfer.quote_expires_at && new Date() > transfer.quote_expires_at) {
                stopFXUpdateJob(jobId);
                await Transfer.updateStatus(transferId, 'cancelled');
                await TwilioService.sendWhatsAppMessage(phoneNumber, `Quote expired. The exchange rate has changed.`, 'idle_menu');
                return;
            }

            // fetch live rate
            const fxResult = await FXRateService.getLiveFXRate();

            if (!fxResult) {
                stopFXUpdateJob(jobId);
                await onError();
                return;
            }

            // calculate new amounts
            const quote = FXRateService.calculateQuote(data.amountUsd, fxResult.rate);

            // update transfer with new rate
            await Transfer.updateFXRate(transferId, fxResult.rate, quote.amountInr);

            // send update message
            const updateMsg = `Rate Update

━━━━━━━━━━━━━━━━━━━━
${data.transferCode}
━━━━━━━━━━━━━━━━━━━━
Rate: 1 USD = ₹${quote.fxRate.toFixed(4)}
${data.recipientName} receives: ₹${quote.amountInr.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━`;

            await TwilioService.sendWhatsAppMessage(phoneNumber, updateMsg, 'confirm_cancel');

            logger.info('sent fx rate update', { jobId, transferId, rate: fxResult.rate });
        } catch (error) {
            logger.error('fx update job error', { jobId, error });
            stopFXUpdateJob(jobId);
        }
    }, 30000);

    fxUpdateJobs.set(jobId, interval);
    logger.info('started fx update job', { jobId, transferId, phoneNumber });
    return jobId;
}

export function stopFXUpdateJob(jobId: string): void {
    const interval = fxUpdateJobs.get(jobId);
    if (interval) {
        clearInterval(interval);
        fxUpdateJobs.delete(jobId);
        logger.info('stopped fx update job', { jobId });
    }
}

export function stopAllFXUpdateJobs(): void {
    fxUpdateJobs.forEach((interval, jobId) => {
        clearInterval(interval);
        logger.info('stopped fx update job', { jobId });
    });
    fxUpdateJobs.clear();
}
