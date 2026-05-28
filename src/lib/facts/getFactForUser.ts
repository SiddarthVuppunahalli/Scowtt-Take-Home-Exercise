import { generateMovieFact } from "@/lib/openai/generateMovieFact";
import { prisma } from "@/lib/prisma";

type GetFactForUserInput = {
  userId: string;
  movieTitle: string;
  movieKey: string;
  generateFact?: (movieTitle: string) => Promise<string>;
};

export async function getFactForUser({
  userId,
  movieTitle,
  movieKey,
  generateFact = generateMovieFact,
}: GetFactForUserInput) {
  const fact = await generateFact(movieTitle);

  return prisma.movieFact.create({
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
}
