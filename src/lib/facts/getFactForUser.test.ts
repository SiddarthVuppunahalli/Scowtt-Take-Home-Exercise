import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getFactForUser,
  MovieFactUnavailableError,
} from "@/lib/facts/getFactForUser";
import { acquireFactGenerationLock } from "@/lib/facts/factLock";
import { prisma } from "@/lib/prisma";

const testRunId = `fact-service-${Date.now()}`;

describe("getFactForUser", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.factGenerationLock.deleteMany({
      where: {
        userId: {
          startsWith: testRunId,
        },
      },
    });
    await prisma.movieFact.deleteMany({
      where: {
        userId: {
          startsWith: testRunId,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          startsWith: testRunId,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns a cached fact when the latest fact is less than 60 seconds old", async () => {
    const user = await createTestUser("cache");
    const now = new Date("2026-05-28T12:00:00.000Z");
    const generateFact = vi.fn(async () => "new generated fact");

    await prisma.movieFact.create({
      data: {
        userId: user.id,
        movieTitle: "The Matrix",
        movieKey: "the matrix",
        fact: "cached matrix fact",
        createdAt: new Date(now.getTime() - 30_000),
      },
    });

    const result = await getFactForUser({
      userId: user.id,
      movieTitle: "The Matrix",
      movieKey: "the matrix",
      generateFact,
      now,
    });

    expect(result).toMatchObject({
      fact: "cached matrix fact",
      source: "cache",
    });
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("does not return another user's fact for the same movie key", async () => {
    const firstUser = await createTestUser("auth-a");
    const secondUser = await createTestUser("auth-b");
    const now = new Date("2026-05-28T12:00:00.000Z");
    const generateFact = vi.fn(async () => "second user generated fact");

    await prisma.movieFact.create({
      data: {
        userId: firstUser.id,
        movieTitle: "Alien",
        movieKey: "alien",
        fact: "first user private fact",
        createdAt: new Date(now.getTime() - 30_000),
      },
    });

    const result = await getFactForUser({
      userId: secondUser.id,
      movieTitle: "Alien",
      movieKey: "alien",
      generateFact,
      now,
    });

    expect(result).toMatchObject({
      fact: "second user generated fact",
      source: "generated",
    });
    expect(generateFact).toHaveBeenCalledOnce();

    const secondUserFacts = await prisma.movieFact.findMany({
      where: {
        userId: secondUser.id,
        movieKey: "alien",
      },
    });

    expect(secondUserFacts).toHaveLength(1);
    expect(secondUserFacts[0].fact).toBe("second user generated fact");
  });

  it("only generates one fact for simultaneous requests for the same user and movie", async () => {
    const user = await createTestUser("lock");
    const generateFact = vi.fn(async () => {
      await sleep(200);
      return "single generated lock fact";
    });

    const [firstResult, secondResult] = await Promise.all([
      getFactForUser({
        userId: user.id,
        movieTitle: "Heat",
        movieKey: "heat",
        generateFact,
      }),
      getFactForUser({
        userId: user.id,
        movieTitle: "Heat",
        movieKey: "heat",
        generateFact,
      }),
    ]);

    expect(generateFact).toHaveBeenCalledOnce();
    expect([firstResult.source, secondResult.source].sort()).toEqual([
      "cache",
      "generated",
    ]);
    expect(firstResult.fact).toBe("single generated lock fact");
    expect(secondResult.fact).toBe("single generated lock fact");

    const savedFacts = await prisma.movieFact.findMany({
      where: {
        userId: user.id,
        movieKey: "heat",
      },
    });

    expect(savedFacts).toHaveLength(1);
  });

  it("returns the latest stale fact when generation fails", async () => {
    const user = await createTestUser("fallback");
    const now = new Date("2026-05-28T12:00:00.000Z");
    const generateFact = vi.fn(async () => {
      throw new Error("OpenAI unavailable");
    });

    await prisma.movieFact.create({
      data: {
        userId: user.id,
        movieTitle: "Inception",
        movieKey: "inception",
        fact: "older inception fact",
        createdAt: new Date(now.getTime() - 120_000),
      },
    });

    const result = await getFactForUser({
      userId: user.id,
      movieTitle: "Inception",
      movieKey: "inception",
      generateFact,
      now,
    });

    expect(result).toMatchObject({
      fact: "older inception fact",
      source: "fallback",
    });
    expect(generateFact).toHaveBeenCalledOnce();
  });

  it("returns a stale fallback fact when another request owns the lock and no newer fact appears", async () => {
    const user = await createTestUser("locked-fallback");
    const now = new Date("2026-05-28T12:00:00.000Z");
    const generateFact = vi.fn(async () => "should not be generated");

    await prisma.movieFact.create({
      data: {
        userId: user.id,
        movieTitle: "Jaws",
        movieKey: "jaws",
        fact: "older jaws fact",
        createdAt: new Date(now.getTime() - 120_000),
      },
    });

    const lock = await acquireFactGenerationLock({
      userId: user.id,
      movieKey: "jaws",
      now,
    });

    expect(lock.acquired).toBe(true);

    const result = await getFactForUser({
      userId: user.id,
      movieTitle: "Jaws",
      movieKey: "jaws",
      generateFact,
      now,
    });

    expect(result).toMatchObject({
      fact: "older jaws fact",
      source: "fallback",
    });
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("throws a friendly error when generation fails and no fact exists", async () => {
    const user = await createTestUser("no-fallback");
    const generateFact = vi.fn(async () => {
      throw new Error("OpenAI unavailable");
    });

    await expect(
      getFactForUser({
        userId: user.id,
        movieTitle: "Arrival",
        movieKey: "arrival",
        generateFact,
      }),
    ).rejects.toBeInstanceOf(MovieFactUnavailableError);
  });
});

async function createTestUser(label: string) {
  const id = `${testRunId}-${label}`;

  return prisma.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      name: `Test User ${label}`,
    },
  });
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
