import twilio, { Twilio } from "twilio";
import {
  TwilioWebhookPayload,
  ParsedMessage,
  SendResult,
} from "../types/twilio";
import * as logger from "../utils/logger";

let client: Twilio;

export type ContentTemplate =
  | "idle_menu"
  | "yes_no"
  | "confirm_cancel"
  | "pay_cancel"
  | "link_bank"
  | "bank_selection"
  | "payment_method"
  | "add_recipient";

const CONTENT_SID_MAP: Record<ContentTemplate, string> = {
  idle_menu: "CONTENT_SID_IDLE_MENU",
  yes_no: "CONTENT_SID_YES_NO",
  confirm_cancel: "CONTENT_SID_CONFIRM_CANCEL",
  pay_cancel: "CONTENT_SID_PAY_CANCEL",
  link_bank: "CONTENT_SID_LINK_BANK",
  bank_selection: "CONTENT_SID_BANK_SELECTION",
  payment_method: "CONTENT_SID_PAYMENT_METHOD",
  add_recipient: "CONTENT_SID_ADD_RECIPIENT",
};

export function initTwilioClient(): void {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }

  client = twilio(accountSid, authToken);
  logger.info("twilio client initialized");
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  template?: ContentTemplate,
): Promise<SendResult> {
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!fromNumber) {
    return { success: false, error: "TWILIO_WHATSAPP_NUMBER not configured" };
  }

  try {
    // if template specified, send as content message with buttons
    if (template) {
      const envVar = CONTENT_SID_MAP[template];
      const contentSid = process.env[envVar];

      if (contentSid) {
        // only send body text if message is not empty
        if (message && message.trim().length > 0) {
          await client.messages.create({
            from: `whatsapp:${fromNumber}`,
            to: `whatsapp:${to}`,
            body: message,
          });
        }

        // send template with buttons
        const buttonResult = await client.messages.create({
          from: `whatsapp:${fromNumber}`,
          to: `whatsapp:${to}`,
          contentSid: contentSid,
        });

        logger.info("message with buttons sent", {
          to,
          template,
          messageSid: buttonResult.sid,
        });
        return { success: true, messageSid: buttonResult.sid };
      } else {
        logger.warn("content sid not configured", { template, envVar });
      }
    }

    // fallback: send plain text message (only if non-empty)
    if (!message || message.trim().length === 0) {
      logger.warn("no message body to send and no template", { to });
      return { success: false, error: "No message body or template" };
    }

    const result = await client.messages.create({
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${to}`,
      body: message,
    });

    logger.info("message sent", { to, messageSid: result.sid });
    return { success: true, messageSid: result.sid };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    logger.error("twilio send failed", { to, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

export function parseIncomingMessage(
  body: TwilioWebhookPayload,
): ParsedMessage {
  const from = body.From.replace("whatsapp:", "");

  // use ButtonPayload or ButtonText if present, otherwise use Body
  let message = body.Body.trim();
  if (body.ButtonPayload) {
    message = body.ButtonPayload;
  } else if (body.ButtonText) {
    message = body.ButtonText;
  }

  return {
    from,
    message,
    timestamp: new Date(),
    messageSid: body.MessageSid,
  };
}
