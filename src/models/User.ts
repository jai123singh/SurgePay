import { query } from '../config/database';
import { User } from '../types';

// data required to create a new user
interface CreateUserData {
    phone_number: string;
    full_name: string;
    email: string;
    date_of_birth: string;
    address: string;
}

// database row shape
interface UserRow {
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

export async function create(data: CreateUserData): Promise<User> {
    const sql = `
    INSERT INTO users (phone_number, full_name, email, date_of_birth, address)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
    const values = [
        data.phone_number,
        data.full_name,
        data.email,
        data.date_of_birth,
        data.address
    ];
    const result = await query<UserRow>(sql, values);
    return result.rows[0];
}

export async function findByPhone(phone: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE phone_number = $1';
    const result = await query<UserRow>(sql, [phone]);
    return result.rows[0] || null;
}

export async function findById(id: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = $1';
    const result = await query<UserRow>(sql, [id]);
    return result.rows[0] || null;
}
