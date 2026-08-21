import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../generated/prisma/client';

let prisma: InstanceType<typeof PrismaClient> | undefined;
let activeDatabaseUrl: string | undefined;

export type DatabaseClient = InstanceType<typeof PrismaClient>;

const createPrismaClient = (databaseUrl: string) => {
  const url = new URL(databaseUrl);

  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql protocol');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database.length === 0) {
    throw new Error('DATABASE_URL must include a database name');
  }

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port.length > 0 ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 5,
  });

  return new PrismaClient({ adapter });
};

const getPrismaClient = (databaseUrl: string) => {
  if (prisma === undefined || activeDatabaseUrl !== databaseUrl) {
    prisma = createPrismaClient(databaseUrl);
    activeDatabaseUrl = databaseUrl;
  }

  return prisma;
};

export const getDatabase = (): DatabaseClient => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  return getPrismaClient(databaseUrl);
};

export const checkDatabaseReadiness = async (): Promise<boolean> => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    return false;
  }

  try {
    const client = getDatabase();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export const disconnectDatabase = async () => {
  if (prisma !== undefined) {
    await prisma.$disconnect();
    prisma = undefined;
    activeDatabaseUrl = undefined;
  }
};
