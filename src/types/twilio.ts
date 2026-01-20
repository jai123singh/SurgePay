// types for twilio whatsapp integration

export interface TwilioWebhookPayload {
    MessageSid: string;
    AccountSid: string;
    From: string;
    To: string;
    Body: string;
    NumMedia: string;
    NumSegments: string;
    ButtonText?: string;
    ButtonPayload?: string;
}

export interface ParsedMessage {
    from: string;
    message: string;
    timestamp: Date;
    messageSid: string;
}

export interface SendResult {
    success: boolean;
    messageSid?: string;
    error?: string;
}
