import { afterAll } from 'vitest';
import { prisma } from '../database/prisma.js';

// Close the shared connection pool once the whole integration run finishes.
afterAll(async () => {
  await prisma.$disconnect();
});
