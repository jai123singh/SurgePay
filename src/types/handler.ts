import { SessionDataContent } from './session';
import { User } from './index';
import { ContentTemplate } from '../services/TwilioService';

export interface HandlerContext {
    user: User | null;
    message: string;
    phoneNumber: string;
    sessionData: SessionDataContent;
}

export interface HandlerResult {
    nextState: string;
    response: string;
    data?: Partial<SessionDataContent>;
    template?: ContentTemplate;
}

export type StateHandler = (context: HandlerContext) => Promise<HandlerResult>;
