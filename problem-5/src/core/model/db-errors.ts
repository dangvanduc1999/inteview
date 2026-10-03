import { Prisma } from '@prisma/client';

type Known = Prisma.PrismaClientKnownRequestError;

/**
 * Turns Prisma's known request errors into the errors the API should answer with, so races
 * (a record removed or created between a check and the write) do not surface as 500s.
 * - `P2002`: unique constraint violated
 * - `P2025`: a record the operation depends on was not found
 */
export async function translateDbErrors<T>(
  operation: Promise<T>,
  map: Partial<Record<'P2002' | 'P2025', (err: Known) => Error>>,
): Promise<T> {
  try {
    return await operation;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const translate = map[err.code as 'P2002' | 'P2025'];
      if (translate) throw translate(err);
    }
    throw err;
  }
}

/** True when a P2025 came from `connect`/`set` on related records, not from the main `where`. */
export const isMissingRelation = (err: Known) =>
  String(err.meta?.cause ?? '').includes('connected');
