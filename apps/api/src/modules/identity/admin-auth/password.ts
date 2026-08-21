import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';

const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 3;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

const deriveKey = (
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
) =>
  new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error === null) {
          resolve(derivedKey);
          return;
        }

        reject(error);
      },
    );
  });

export const generateStrongPassword = () =>
  randomBytes(32).toString('base64url');

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(
    password,
    salt,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
  );

  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
};

export const verifyPassword = async (
  password: string,
  encodedHash: string,
): Promise<boolean> => {
  const [
    algorithm,
    costValue,
    blockSizeValue,
    parallelizationValue,
    saltValue,
    hashValue,
  ] = encodedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    costValue === undefined ||
    blockSizeValue === undefined ||
    parallelizationValue === undefined ||
    saltValue === undefined ||
    hashValue === undefined
  ) {
    return false;
  }

  const cost = Number(costValue);
  const blockSize = Number(blockSizeValue);
  const parallelization = Number(parallelizationValue);
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    cost <= 1 ||
    blockSize <= 0 ||
    parallelization <= 0
  ) {
    return false;
  }

  try {
    const expectedHash = Buffer.from(hashValue, 'base64url');
    const actualHash = await deriveKey(
      password,
      Buffer.from(saltValue, 'base64url'),
      cost,
      blockSize,
      parallelization,
    );

    return (
      expectedHash.length === actualHash.length &&
      timingSafeEqual(expectedHash, actualHash)
    );
  } catch {
    return false;
  }
};
