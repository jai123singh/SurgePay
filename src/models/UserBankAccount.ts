import { query } from '../config/database';
import { UserBankAccount } from '../types';

// data required to create a bank account
interface CreateBankAccountData {
    user_id: string;
    plaid_access_token: string | null;
    plaid_account_id: string | null;
    account_number: string;
    routing_number: string;
    bank_name: string;
    account_holder_name: string;
    account_type: 'checking' | 'savings';
    is_default: boolean;
}

// database row shape
interface BankAccountRow {
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

export async function create(data: CreateBankAccountData): Promise<UserBankAccount> {
    const sql = `
    INSERT INTO user_bank_accounts (
      user_id, plaid_access_token, plaid_account_id, account_number,
      routing_number, bank_name, account_holder_name, account_type, is_default
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
    const values = [
        data.user_id,
        data.plaid_access_token,
        data.plaid_account_id,
        data.account_number,
        data.routing_number,
        data.bank_name,
        data.account_holder_name,
        data.account_type,
        data.is_default
    ];
    const result = await query<BankAccountRow>(sql, values);
    return result.rows[0];
}

export async function findByUser(
    userId: string,
    activeOnly: boolean = true
): Promise<UserBankAccount[]> {
    let sql = 'SELECT * FROM user_bank_accounts WHERE user_id = $1';
    if (activeOnly) {
        sql += ' AND is_active = true';
    }
    sql += ' ORDER BY is_default DESC, created_at ASC';
    const result = await query<BankAccountRow>(sql, [userId]);
    return result.rows;
}

export async function findDefault(userId: string): Promise<UserBankAccount | null> {
    const sql = `
    SELECT * FROM user_bank_accounts
    WHERE user_id = $1 AND is_default = true AND is_active = true
  `;
    const result = await query<BankAccountRow>(sql, [userId]);
    return result.rows[0] || null;
}

export async function findById(id: string): Promise<UserBankAccount | null> {
    const sql = 'SELECT * FROM user_bank_accounts WHERE id = $1';
    const result = await query<BankAccountRow>(sql, [id]);
    return result.rows[0] || null;
}

export async function setDefault(accountId: string, userId: string): Promise<void> {
    // first remove default from all user's accounts
    await query(
        'UPDATE user_bank_accounts SET is_default = false, updated_at = NOW() WHERE user_id = $1',
        [userId]
    );
    // then set the specified account as default
    await query(
        'UPDATE user_bank_accounts SET is_default = true, updated_at = NOW() WHERE id = $1',
        [accountId]
    );
}

export async function deactivate(accountId: string): Promise<void> {
    await query(
        'UPDATE user_bank_accounts SET is_active = false, updated_at = NOW() WHERE id = $1',
        [accountId]
    );
}

export async function countByUser(userId: string): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM user_bank_accounts WHERE user_id = $1 AND is_active = true';
    const result = await query<{ count: string }>(sql, [userId]);
    return parseInt(result.rows[0].count, 10);
}
