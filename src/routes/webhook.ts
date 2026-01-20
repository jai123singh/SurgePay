import { Router, Request, Response } from 'express';
import { TwilioWebhookPayload } from '../types/twilio';
import * as TwilioService from '../services/TwilioService';
import * as ConversationController from '../controllers/ConversationController';
import * as logger from '../utils/logger';

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const payload = req.body as TwilioWebhookPayload;

        // ignore status callbacks (delivery receipts) - they don't have a Body
        if (!payload.Body && !payload.ButtonPayload && !payload.ButtonText) {
            logger.debug('ignoring status callback', { sid: payload.MessageSid });
            res.status(200).send('');
            return;
        }

        const parsed = TwilioService.parseIncomingMessage(payload);

        logger.info('received message', { from: parsed.from, message: parsed.message });

        const result = await ConversationController.handleIncomingMessage(
            parsed.from,
            parsed.message
        );

        await TwilioService.sendWhatsAppMessage(parsed.from, result.response, result.template);

        res.status(200).send('');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        logger.error('webhook error', { error: errorMessage });
        res.status(500).send('Internal Server Error');
    }
});

export default router;
