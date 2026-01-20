// session data types for managing conversation state

// data returned from plaid connection
export interface PlaidConnectionData {
    access_token: string;
    account_id: string;
    account_number: string;
    routing_number: string;
    bank_name: string;
    account_type: string;
    account_holder: string;
}

// form data while adding a recipient
export interface RecipientFormData {
    nickname?: string;
    payment_method?: 'upi' | 'bank';
    upi_id?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    verification_name?: string;
}

// all possible fields stored in session
export interface SessionDataContent {
    // user onboarding
    name?: string;
    email?: string;
    dob?: string;
    address?: string;

    // plaid connection
    bankKey?: string;
    plaidData?: PlaidConnectionData;

    // recipient form
    currentRecipient?: RecipientFormData;
    selectedRecipientId?: string;

    // transfer
    transferId?: string;
    selectedBankAccountId?: string;

    // flags
    addingBank?: boolean;
    awaitingRemoveConfirm?: boolean;
    bankToRemove?: string;
    editingRecipientId?: string;

    // transfer processing state
    transferProcessing?: boolean;
    activeTransferId?: string;

    // fx rate update tracking
    fxUpdateJobId?: string;
    quoteStartedAt?: string;
}

// complete session state
export interface SessionState {
    state: string;
    data: SessionDataContent;
    createdAt: string;
}
