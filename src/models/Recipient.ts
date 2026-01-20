import { query } from '../config/database';
import { Recipient } from '../types';

// data required to create a recipient
interface CreateRecipientData {
    user_id: string;
    nickname: string;
    payment_method: 'upi' | 'bank';
    upi_id?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    account_holder_name?: string;
    verified?: boolean;
    verification_name?: string;
}

// database row shape
interface RecipientRow {
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

export async function create(data: CreateRecipientData): Promise<Recipient> {
    const sql = `
    INSERT INTO recipients (
      user_id, nickname, payment_method, upi_id, account_number,
      ifsc_code, bank_name, account_holder_name, verified, verification_name
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
    const values = [
        data.user_id,
        data.nickname,
        data.payment_method,
        data.upi_id || null,
        data.account_number || null,
        data.ifsc_code || null,
        data.bank_name || null,
        data.account_holder_name || null,
        data.verified || false,
        data.verification_name || null
    ];
    const result = await query<RecipientRow>(sql, values);
    return result.rows[0];
}

export async function findByUser(
    userId: string,
    activeOnly: boolean = true
): Promise<Recipient[]> {
    let sql = 'SELECT * FROM recipients WHERE user_id = $1';
    if (activeOnly) {
        sql += ' AND is_active = true';
    }
    sql += ' ORDER BY created_at ASC';
    const result = await query<RecipientRow>(sql, [userId]);
    return result.rows;
}

export async function findById(id: string): Promise<Recipient | null> {
    const sql = 'SELECT * FROM recipients WHERE id = $1';
    const result = await query<RecipientRow>(sql, [id]);
    return result.rows[0] || null;
}

export async function findByNickname(
    userId: string,
    nickname: string
): Promise<Recipient | null> {
    // case-insensitive search for nickname
    const sql = `
    SELECT * FROM recipients
    WHERE user_id = $1 AND LOWER(nickname) = LOWER($2) AND is_active = true
  `;
    const result = await query<RecipientRow>(sql, [userId, nickname]);
    return result.rows[0] || null;
}

export async function update(
    id: string,
    data: Partial<CreateRecipientData>
): Promise<Recipient | null> {
    // build dynamic update query based on provided fields
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    if (data.nickname !== undefined) {
        paramCount++;
        fields.push(`nickname = $${paramCount}`);
        values.push(data.nickname);
    }
    if (data.payment_method !== undefined) {
        paramCount++;
        fields.push(`payment_method = $${paramCount}`);
        values.push(data.payment_method);
    }
    if (data.upi_id !== undefined) {
        paramCount++;
        fields.push(`upi_id = $${paramCount}`);
        values.push(data.upi_id);
    }
    if (data.account_number !== undefined) {
        paramCount++;
        fields.push(`account_number = $${paramCount}`);
        values.push(data.account_number);
    }
    if (data.ifsc_code !== undefined) {
        paramCount++;
        fields.push(`ifsc_code = $${paramCount}`);
        values.push(data.ifsc_code);
    }
    if (data.bank_name !== undefined) {
        paramCount++;
        fields.push(`bank_name = $${paramCount}`);
        values.push(data.bank_name);
    }
    if (data.account_holder_name !== undefined) {
        paramCount++;
        fields.push(`account_holder_name = $${paramCount}`);
        values.push(data.account_holder_name);
    }
    if (data.verified !== undefined) {
        paramCount++;
        fields.push(`verified = $${paramCount}`);
        values.push(data.verified);
    }
    if (data.verification_name !== undefined) {
        paramCount++;
        fields.push(`verification_name = $${paramCount}`);
        values.push(data.verification_name);
    }

    if (fields.length === 0) {
        return findById(id);
    }

    fields.push('updated_at = NOW()');
    paramCount++;
    values.push(id);

    const sql = `
    UPDATE recipients
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

    const result = await query<RecipientRow>(sql, values);
    return result.rows[0] || null;
}

export async function softDelete(id: string): Promise<void> {
    await query(
        'UPDATE recipients SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
    );
}
