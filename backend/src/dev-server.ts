// ============================================================================
// File: backend/src/dev-server.ts
// Description: Local development server with embedded PGlite database
// ============================================================================

import { serve } from '@hono/node-server';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { app } from './index.js';
import { setTestDatabaseClient } from './services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

async function startServer() {
  console.log('🚀 Initializing Local Loyalty Database (PGlite)...');
  const db = new PGlite();

  const migrations = [
    'database/migrations/00001_initial_schema.sql',
    'database/migrations/00002_functions_and_triggers.sql',
    'database/migrations/00003_rls_policies.sql',
    'database/migrations/00004_sa_dosa_cafe_and_stamp_claims.sql',
    'database/seeds/00001_demo_seed.sql',
  ];

  for (const file of migrations) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`  Applying: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await db.exec(sql);
    } else {
      console.warn(`  Warning: Migration not found: ${filePath}`);
    }
  }

  setTestDatabaseClient(db);
  console.log('✅ Database initialized and seeded with S A Dosa Cafe pilot data.');

  const env = {
    ENVIRONMENT: 'development',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'local-dev-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'local-dev-service-role-key',
  };

  const PORT = 8787;

  serve(
    {
      fetch: (req) => app.fetch(req, env),
      port: PORT,
    },
    (info) => {
      console.log('\n========================================================');
      console.log(`  🍔 S A Dosa Cafe Local API Server Running!`);
      console.log(`  📡 API URL: http://localhost:${info.port}`);
      console.log(`  🏥 Health Check: http://localhost:${info.port}/api/health`);
      console.log(`  📱 S A Dosa Cafe Landing: http://localhost:${info.port}/api/r/sa-dosa-cafe`);
      console.log('========================================================\n');
      console.log('  Demo Customer Logins (OTP: 123456):');
      console.log('  - Pradyumna Joshi: +15550000001 (3 of 7 stamps)');
      console.log('  - Ananya Rao:      +15550000002 (6 of 7 stamps - unlock celebration ready)');
      console.log('========================================================\n');
    }
  );
}

startServer().catch((err) => {
  console.error('Failed to start local dev server:', err);
  process.exit(1);
});
