import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * `prisma generate` never connects. Render's Node build has no DATABASE_URL
 * at that step, and a missing variable used to abort the whole image.
 * Migrate and studio still require the real URL.
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
const generating = process.argv.includes('generate');
const generatePlaceholder = 'postgresql://build:build@127.0.0.1:5432/build?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl || (generating ? generatePlaceholder : env('DATABASE_URL')),
  },
});
