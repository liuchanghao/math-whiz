import { checkDatabaseReadiness } from '../src/infrastructure/database';

const ready = await checkDatabaseReadiness();

if (!ready) {
  console.error('Database readiness check failed.');
  process.exitCode = 1;
} else {
  console.log('Database readiness check passed.');
}
