// core data types for surgepay whatsapp bot

export interface User {
    id: string;
    phone_number: string;
    full_name: string;
    email: string;
    date_of_birth: Date;
    address: string;
    kyc_status: 'pending' | 'verified' | 'rejected';
    created_at: Date;
    updated_at: Date;
}

export interface UserBankAccount {
    id: string;
    user_id: string;
    plaid_access_token: string | null;
    plaid_account_id: string | null;
    account_number: string;
    routing_number: string;
    bank_name: string;
    account_holder_name: string;
    account_type: 'checking' | 'savings';
    connection_method: 'plaid' | 'manual';
    verified: boolean;
    is_active: boolean;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Recipient {
    id: string;
    user_id: string;
    nickname: string;
    payment_method: 'upi' | 'bank';
    upi_id: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    bank_name: string | null;
    account_holder_name: string | null;
    verified: boolean;
    verification_name: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export type TransferStatus =
    | 'quote'
    | 'processing_withdrawal'
    | 'processing_payout'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface Transfer {
    id: string;
    transfer_code: string;
    user_id: string;
    recipient_id: string;
    user_bank_account_id: string | null;
    amount_usd: number;
    fx_rate: number;
    fee_usd: number;
    amount_inr: number;
    status: TransferStatus;
    quote_created_at: Date;
    quote_expires_at: Date | null;
    withdrawal_initiated_at: Date | null;
    withdrawal_completed_at: Date | null;
    payout_initiated_at: Date | null;
    payout_completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
