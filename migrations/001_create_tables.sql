-- surgepay database schema
-- run this migration to create all required tables

-- table 1: users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  kyc_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_kyc_status CHECK (kyc_status IN ('pending', 'verified', 'rejected'))
);

CREATE INDEX idx_users_phone ON users(phone_number);

-- table 2: user bank accounts (linked via plaid)
CREATE TABLE user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaid_access_token VARCHAR(255),
  plaid_account_id VARCHAR(255),
  account_number VARCHAR(50) NOT NULL,
  routing_number VARCHAR(9) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_holder_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) DEFAULT 'checking',
  connection_method VARCHAR(20) DEFAULT 'plaid',
  verified BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_account UNIQUE (account_number, routing_number),
  CONSTRAINT valid_account_type CHECK (account_type IN ('checking', 'savings'))
);

CREATE INDEX idx_user_banks ON user_bank_accounts(user_id, is_active);

-- table 3: recipients (upi or bank details in india)
CREATE TABLE recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  upi_id VARCHAR(100),
  account_number VARCHAR(50),
  ifsc_code VARCHAR(11),
  bank_name VARCHAR(100),
  account_holder_name VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  verification_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('upi', 'bank'))
);

CREATE INDEX idx_recipients_user ON recipients(user_id, is_active);

-- table 4: transfers
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_code VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES recipients(id),
  user_bank_account_id UUID REFERENCES user_bank_accounts(id),
  amount_usd DECIMAL(10,2) NOT NULL,
  fx_rate DECIMAL(10,4) NOT NULL,
  fee_usd DECIMAL(10,2) NOT NULL,
  amount_inr DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  quote_created_at TIMESTAMP DEFAULT NOW(),
  quote_expires_at TIMESTAMP,
  withdrawal_initiated_at TIMESTAMP,
  withdrawal_completed_at TIMESTAMP,
  payout_initiated_at TIMESTAMP,
  payout_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT valid_status CHECK (
    status IN ('quote', 'processing_withdrawal', 'processing_payout', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT valid_amount CHECK (amount_usd >= 10 AND amount_usd <= 10000)
);

CREATE UNIQUE INDEX idx_transfer_code ON transfers(transfer_code);
CREATE INDEX idx_transfers_user ON transfers(user_id, created_at DESC);
CREATE INDEX idx_transfers_status ON transfers(status);

-- prevent duplicate active transfers for same user, recipient, and amount
CREATE UNIQUE INDEX idx_active_transfer ON transfers(user_id, recipient_id, amount_usd)
  WHERE status IN ('quote', 'processing_withdrawal', 'processing_payout');

-- table 5: sessions (fallback when redis unavailable)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(20) NOT NULL UNIQUE,
  current_state VARCHAR(50) NOT NULL,
  session_data JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
