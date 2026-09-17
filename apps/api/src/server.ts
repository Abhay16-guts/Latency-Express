import { buildApp } from './app.js';
import { config } from './config/env.js';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 Latency Express API server listening on http://localhost:${config.PORT}`);
    console.log(`📊 Health check available at http://localhost:${config.PORT}/health`);
    console.log(`📈 Live metrics available at http://localhost:${config.PORT}/admin/telemetry`);
  } catch (err) {
    console.error('Fatal error during API server bootstrap:', err);
    process.exit(1);
  }
}

start();
