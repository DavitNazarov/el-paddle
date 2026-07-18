import { processOutboxBatch } from './workers/outbox.worker.js';

async function run() {
  for (;;) {
    const count = await processOutboxBatch(25, { mode: 'email', expireOpponentRequests: true });
    await new Promise((resolve) => setTimeout(resolve, count ? 250 : 2_000));
  }
}

run().catch((error) => {
  console.error('[worker:fatal]', error);
  process.exit(1);
});
