import { query } from '../config/database';
import { Transfer, TransferStatus } from '../types';

// pg returns decimal fields as strings to preserve precision
interface TransferRow {
    id: string;
    transfer_code: string;
    user_id: string;
    recipient_id: string;
    user_bank_account_id: string | null;
    amount_usd: string;
    fx_rate: string;
    fee_usd: string;
    amount_inr: string;
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

// convert database row to application type with parsed decimals
function parseTransferRow(row: TransferRow): Transfer {
    return {
        ...row,
        amount_usd: parseFloat(row.amount_usd),
        fx_rate: parseFloat(row.fx_rate),
        fee_usd: parseFloat(row.fee_usd),
        amount_inr: parseFloat(row.amount_inr)
    };
}

// data required to create a transfer
interface CreateTransferData {
    transfer_code: string;
    user_id: string;
    recipient_id: string;
    amount_usd: number;
    fx_rate: number;
    fee_usd: number;
    amount_inr: number;
    status: TransferStatus;
    quote_expires_at: Date;
}

export async function create(data: CreateTransferData): Promise<Transfer> {
    const sql = `
    INSERT INTO transfers (
      transfer_code, user_id, recipient_id, amount_usd, fx_rate,
      fee_usd, amount_inr, status, quote_expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
    const values = [
        data.transfer_code,
        data.user_id,
        data.recipient_id,
        data.amount_usd.toFixed(2),
        data.fx_rate.toFixed(4),
        data.fee_usd.toFixed(2),
        data.amount_inr.toFixed(2),
        data.status,
        data.quote_expires_at
    ];
    const result = await query<TransferRow>(sql, values);
    return parseTransferRow(result.rows[0]);
}

export async function findByCode(code: string): Promise<Transfer | null> {
    const sql = 'SELECT * FROM transfers WHERE transfer_code = $1';
    const result = await query<TransferRow>(sql, [code]);
    if (!result.rows[0]) return null;
    return parseTransferRow(result.rows[0]);
}

export async function findById(id: string): Promise<Transfer | null> {
    const sql = 'SELECT * FROM transfers WHERE id = $1';
    const result = await query<TransferRow>(sql, [id]);
    if (!result.rows[0]) return null;
    return parseTransferRow(result.rows[0]);
}

export async function findByUser(
    userId: string,
    limit: number = 10
): Promise<Transfer[]> {
    const sql = `
    SELECT * FROM transfers
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
    const result = await query<TransferRow>(sql, [userId, limit]);
    return result.rows.map(parseTransferRow);
}

export async function findActive(
    userId: string,
    recipientId: string,
    amountUsd: number
): Promise<Transfer | null> {
    const sql = `
    SELECT * FROM transfers
    WHERE user_id = $1
      AND recipient_id = $2
      AND amount_usd = $3
      AND status IN ('quote', 'processing_withdrawal', 'processing_payout')
  `;
    const result = await query<TransferRow>(sql, [
        userId,
        recipientId,
        amountUsd.toFixed(2)
    ]);
    if (!result.rows[0]) return null;
    return parseTransferRow(result.rows[0]);
}

export async function updateStatus(
    id: string,
    status: TransferStatus,
    timestampField?: string
): Promise<Transfer | null> {
    let sql = 'UPDATE transfers SET status = $1, updated_at = NOW()';
    const values: unknown[] = [status];

    // optionally set a timestamp field like withdrawal_initiated_at
    if (timestampField) {
        sql += `, ${timestampField} = NOW()`;
    }

    values.push(id);
    sql += ` WHERE id = $${values.length} RETURNING *`;

    const result = await query<TransferRow>(sql, values);
    if (!result.rows[0]) return null;
    return parseTransferRow(result.rows[0]);
}

export async function updateBankAccount(
    id: string,
    bankAccountId: string
): Promise<void> {
    await query(
        'UPDATE transfers SET user_bank_account_id = $1, updated_at = NOW() WHERE id = $2',
        [bankAccountId, id]
    );
}

export async function updateTimestamp(
    id: string,
    timestampField: string
): Promise<void> {
    const sql = `UPDATE transfers SET ${timestampField} = NOW(), updated_at = NOW() WHERE id = $1`;
    await query(sql, [id]);
}

export async function updateFXRate(
    id: string,
    fxRate: number,
    amountInr: number
): Promise<void> {
    await query(
        'UPDATE transfers SET fx_rate = $1, amount_inr = $2, updated_at = NOW() WHERE id = $3',
        [fxRate.toFixed(4), amountInr.toFixed(2), id]
    );
}

