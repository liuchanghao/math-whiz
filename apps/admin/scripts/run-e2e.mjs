import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const adminPort = 3100;
const apiPort = 3101;
const adminOrigin = `http://localhost:${adminPort}`;
const apiOrigin = `http://localhost:${apiPort}`;
const apiDirectory = resolve('..', 'api');
const adminNextCli = resolve('node_modules/next/dist/bin/next');
const apiNextCli = resolve(apiDirectory, 'node_modules/next/dist/bin/next');
const playwrightCli = resolve('node_modules/@playwright/test/cli.js');
const pnpmCli = process.env.npm_execpath;
const databaseUrl = process.env.E2E_DATABASE_URL;
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? 'math_admin';
const adminPassword =
  process.env.E2E_ADMIN_PASSWORD ??
  'integration-only-password-4vPteuKz2S6Dq9Yx';

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    'E2E_DATABASE_URL is required for the administrator E2E test',
  );
}
if (pnpmCli === undefined) {
  throw new Error('The administrator E2E test must be started through pnpm');
}

const run = (command, arguments_, options = {}) =>
  new Promise((resolveProcess, reject) => {
    const child = spawn(command, arguments_, {
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolveProcess(code ?? 1));
  });

const runOrThrow = async (label, command, arguments_, options = {}) => {
  const exitCode = await run(command, arguments_, options);
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
};

const waitForUrl = async (url, servers) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const stoppedServer = servers.find((server) => server.exitCode !== null);
    if (stoppedServer !== undefined) {
      throw new Error(
        `A production server exited before ${url} became ready (exit code ${stoppedServer.exitCode})`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const assertPortIsFree = (port) =>
  new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort));
  });

const findWindowsListener = (port) => {
  const result = spawnSync('netstat', ['-ano'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = result.stdout.replaceAll('\\r\\n', '\n');
  const pattern = new RegExp(
    `^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`,
    'imu',
  );
  return pattern.exec(output)?.[1];
};

const stopServer = async (server, port) => {
  if (process.platform === 'win32') {
    const listenerPid = findWindowsListener(port);
    const processIds = new Set(
      [listenerPid, server.pid?.toString()].filter(
        (processId) => processId !== undefined,
      ),
    );
    for (const processId of processIds) {
      try {
        process.kill(Number(processId), 'SIGTERM');
      } catch {
        // A short-lived launcher may already have exited.
      }
    }
    return;
  }

  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolveExit) => server.once('exit', resolveExit));
  }
};

const sharedTestEnvironment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  E2E_ADMIN_USERNAME: adminUsername,
  E2E_ADMIN_PASSWORD: adminPassword,
};
const apiEnvironment = {
  ...sharedTestEnvironment,
  ADMIN_WEB_ORIGIN: adminOrigin,
  AUDIT_HMAC_SECRET: 'e2e-audit-hmac-secret-with-at-least-32-characters',
};
const adminEnvironment = {
  ...sharedTestEnvironment,
  NEXT_PUBLIC_API_BASE_URL: apiOrigin,
};

await Promise.all([assertPortIsFree(adminPort), assertPortIsFree(apiPort)]);
await runOrThrow(
  'E2E administrator seed',
  process.execPath,
  [pnpmCli, '--dir', apiDirectory, 'db:seed-e2e'],
  { env: sharedTestEnvironment },
);
await runOrThrow(
  'API production build',
  process.execPath,
  [pnpmCli, '--dir', apiDirectory, 'build'],
  {
    env: apiEnvironment,
  },
);
await runOrThrow(
  'administrator production build',
  process.execPath,
  [adminNextCli, 'build'],
  {
    env: adminEnvironment,
  },
);

const apiServer = spawn(
  process.execPath,
  [apiNextCli, 'start', '--port', String(apiPort)],
  {
    cwd: apiDirectory,
    env: apiEnvironment,
    stdio: 'inherit',
    windowsHide: true,
  },
);
const adminServer = spawn(
  process.execPath,
  [adminNextCli, 'start', '--port', String(adminPort)],
  {
    env: adminEnvironment,
    stdio: 'inherit',
    windowsHide: true,
  },
);

try {
  const servers = [apiServer, adminServer];
  await Promise.all([
    waitForUrl(`${apiOrigin}/health/live`, servers),
    waitForUrl(`${adminOrigin}/login`, servers),
  ]);
  process.exitCode = await run(process.execPath, [playwrightCli, 'test'], {
    env: sharedTestEnvironment,
  });
} finally {
  await Promise.all([
    stopServer(adminServer, adminPort),
    stopServer(apiServer, apiPort),
  ]);
}
