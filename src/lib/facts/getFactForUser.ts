import {
  acquireFactGenerationLock,
  releaseFactGenerationLock,
} from "@/lib/facts/factLock";
import { generateMovieFact } from "@/lib/openai/generateMovieFact";
import { prisma } from "@/lib/prisma";

const FACT_CACHE_WINDOW_MS = 60_000;
const LOCK_WAIT_ATTEMPTS = 5;
const LOCK_WAIT_MS = 300;
const GENERATION_UNAVAILABLE_MESSAGE =
  "We could not generate a movie fact right now. Try again soon.";

type GetFactForUserInput = {
  userId: string;
  movieTitle: string;
  movieKey: string;
  generateFact?: (movieTitle: string) => Promise<string>;
  now?: Date;
};

export class MovieFactUnavailableError extends Error {
  constructor(message = GENERATION_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "MovieFactUnavailableError";
  }
}

export async function getFactForUser({
  userId,
  movieTitle,
  movieKey,
  generateFact = generateMovieFact,
  now = new Date(),
}: GetFactForUserInput) {
  const cachedFact = await findLatestFact({ userId, movieKey });

  if (
    cachedFact &&
    now.getTime() - cachedFact.createdAt.getTime() < FACT_CACHE_WINDOW_MS
  ) {
    return {
      ...cachedFact,
      source: "cache" as const,
    };
  }

  const lock = await acquireFactGenerationLock({
    userId,
    movieKey,
    now,
  });

  if (!lock.acquired) {
    const generatedByOtherRequest = await waitForGeneratedFact({
      userId,
      movieKey,
    });

    if (generatedByOtherRequest) {
      return {
        ...generatedByOtherRequest,
        source: "cache" as const,
      };
    }

    throw new Error("A movie fact is already being generated. Try again soon.");
  }

  try {
    const factCreatedAfterLock = await findLatestFact({ userId, movieKey });

    if (
      factCreatedAfterLock &&
      now.getTime() - factCreatedAfterLock.createdAt.getTime() <
        FACT_CACHE_WINDOW_MS
    ) {
      return {
        ...factCreatedAfterLock,
        source: "cache" as const,
      };
    }

    let fact: string;

    try {
      fact = await generateFact(movieTitle);
    } catch (error) {
      console.error("Movie fact generation failed", error);

      if (factCreatedAfterLock) {
        return {
          ...factCreatedAfterLock,
          source: "fallback" as const,
        };
      }

      throw new MovieFactUnavailableError();
    }

    const createdFact = await prisma.movieFact.create({
      data: {
        userId,
        movieTitle,
        movieKey,
        fact,
      },
      select: {
        fact: true,
        createdAt: true,
      },
    });

    return {
      ...createdFact,
      source: "generated" as const,
    };
  } finally {
    await releaseFactGenerationLock({
      userId,
      movieKey,
      ownerId: lock.ownerId,
    });
  }
}

async function findLatestFact(input: { userId: string; movieKey: string }) {
  return prisma.movieFact.findFirst({
    where: input,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      fact: true,
      createdAt: true,
    },
  });
}

async function waitForGeneratedFact(input: { userId: string; movieKey: string }) {
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
    await sleep(LOCK_WAIT_MS);

    const latestFact = await findLatestFact(input);

    if (latestFact) {
      return latestFact;
    }
  }

  return null;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
