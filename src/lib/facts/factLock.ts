import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const FACT_GENERATION_LOCK_TTL_MS = 30_000;

type FactLockInput = {
  userId: string;
  movieKey: string;
  now?: Date;
};

export type FactGenerationLockOwnership =
  | {
      acquired: true;
      ownerId: string;
      lockedUntil: Date;
    }
  | {
      acquired: false;
    };

export async function acquireFactGenerationLock({
  userId,
  movieKey,
  now = new Date(),
}: FactLockInput): Promise<FactGenerationLockOwnership> {
  const ownerId = randomUUID();
  const lockedUntil = new Date(now.getTime() + FACT_GENERATION_LOCK_TTL_MS);

  const createdLock = await prisma.factGenerationLock.createMany({
    data: {
      userId,
      movieKey,
      ownerId,
      lockedUntil,
    },
    skipDuplicates: true,
  });

  if (createdLock.count === 1) {
    return {
      acquired: true,
      ownerId,
      lockedUntil,
    };
  }

  const refreshedExpiredLock = await prisma.factGenerationLock.updateMany({
    where: {
      userId,
      movieKey,
      lockedUntil: {
        lte: now,
      },
    },
    data: {
      ownerId,
      lockedUntil,
    },
  });

  if (refreshedExpiredLock.count === 1) {
    return {
      acquired: true,
      ownerId,
      lockedUntil,
    };
  }

  return {
    acquired: false,
  };
}

export async function releaseFactGenerationLock({
  userId,
  movieKey,
  ownerId,
}: FactLockInput & { ownerId: string }) {
  await prisma.factGenerationLock.deleteMany({
    where: {
      userId,
      movieKey,
      ownerId,
    },
  });
}
