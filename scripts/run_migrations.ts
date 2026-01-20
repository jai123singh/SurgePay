import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigrations(): Promise<void> {
    console.log('='.repeat(60));
    console.log('SurgePay Migration Runner');
    console.log('='.repeat(60));

    const migrationsDir = path.join(__dirname, '..', 'migrations');

    // check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
        console.error(`Migrations directory not found: ${migrationsDir}`);
        process.exit(1);
    }

    // get all sql files and sort them
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files found.');
        process.exit(0);
    }

    console.log(`Found ${files.length} migration file(s)\n`);

    let successful = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`→ Running: ${file}`);

        try {
            await pool.query(sql);
            console.log(`  ✓ Success`);
            successful++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';

            // handle "already exists" errors gracefully
            if (
                errorMessage.includes('already exists') ||
                errorMessage.includes('duplicate key')
            ) {
                console.log(`  ⊙ Skipped (already exists)`);
                skipped++;
            } else {
                console.error(`  ✗ Failed: ${errorMessage}`);
                failed++;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Successful: ${successful}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(60));

    await pool.end();

    if (failed > 0) {
        process.exit(1);
    }
}

runMigrations().catch(console.error);
