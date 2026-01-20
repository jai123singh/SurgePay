import { getRedisClient, isRedisConnected } from '../config/redis';
import { query } from '../config/database';
import { SessionState, SessionDataContent } from '../types/session';

const SESSION_TTL = 3600; // 1 hour in seconds

export async function getSession(phoneNumber: string): Promise<SessionState | null> {
    // try redis first
    if (isRedisConnected()) {
        try {
            const client = getRedisClient();
            if (client) {
                const key = `session:${phoneNumber}`;
                const data = await client.get(key);
                if (data) {
                    return JSON.parse(data) as SessionState;
                }
            }
        } catch (error) {
            console.error('redis get failed:', error);
        }
    }

    // fallback to postgres
    return getSessionFromDb(phoneNumber);
}

export async function updateSession(
    phoneNumber: string,
    state: string,
    data: SessionDataContent
): Promise<boolean> {
    const session: SessionState = {
        state,
        data,
        createdAt: new Date().toISOString()
    };

    // try redis first
    if (isRedisConnected()) {
        try {
            const client = getRedisClient();
            if (client) {
                const key = `session:${phoneNumber}`;
                await client.setEx(key, SESSION_TTL, JSON.stringify(session));
                return true;
            }
        } catch (error) {
            console.error('redis set failed:', error);
        }
    }

    // fallback to postgres
    return saveSessionToDb(phoneNumber, session);
}

export async function deleteSession(phoneNumber: string): Promise<boolean> {
    // delete from redis
    if (isRedisConnected()) {
        try {
            const client = getRedisClient();
            if (client) {
                await client.del(`session:${phoneNumber}`);
            }
        } catch (error) {
            console.error('redis delete failed:', error);
        }
    }

    // also delete from postgres
    try {
        await query('DELETE FROM sessions WHERE user_id = $1', [phoneNumber]);
        return true;
    } catch (error) {
        console.error('postgres session delete failed:', error);
        return false;
    }
}

// database row shape for sessions
interface SessionRow {
    current_state: string;
    session_data: SessionDataContent;
    created_at: Date;
}

async function getSessionFromDb(phoneNumber: string): Promise<SessionState | null> {
    const sql = `
    SELECT current_state, session_data, created_at
    FROM sessions
    WHERE user_id = $1 AND expires_at > NOW()
  `;
    const result = await query<SessionRow>(sql, [phoneNumber]);

    if (!result.rows[0]) return null;

    return {
        state: result.rows[0].current_state,
        data: result.rows[0].session_data,
        createdAt: result.rows[0].created_at.toISOString()
    };
}

async function saveSessionToDb(
    phoneNumber: string,
    session: SessionState
): Promise<boolean> {
    const sql = `
    INSERT INTO sessions (user_id, current_state, session_data, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
    ON CONFLICT (user_id) DO UPDATE SET
      current_state = $2,
      session_data = $3,
      expires_at = NOW() + INTERVAL '1 hour',
      updated_at = NOW()
  `;

    try {
        await query(sql, [phoneNumber, session.state, JSON.stringify(session.data)]);
        return true;
    } catch (error) {
        console.error('postgres session save failed:', error);
        return false;
    }
}
