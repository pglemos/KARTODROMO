import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const configuredUrl = process.env.NEXT_PUBLICSUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredAnonKey = process.env.NEXT_PUBLICSUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

type QueryResult = {
  data: null;
  error: Error;
};

const notConfiguredResult: QueryResult = {
  data: null,
  error: new Error('Supabase não configurado para este ambiente.'),
};

function createNoopQuery() {
  const query = {
    delete: () => query,
    eq: () => query,
    gt: () => query,
    gte: () => query,
    in: () => query,
    insert: () => query,
    is: () => query,
    limit: () => query,
    lt: () => query,
    lte: () => query,
    neq: () => query,
    order: () => query,
    rpc: () => query,
    select: () => query,
    single: () => query,
    then: (resolve: (value: QueryResult) => void) => Promise.resolve(notConfiguredResult).then(resolve),
    update: () => query,
    upsert: () => query,
  };

  return query;
}

function createNoopSupabase() {
  return {
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: () => undefined }),
      }),
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
    from: () => createNoopQuery(),
    removeChannel: () => undefined,
    rpc: () => createNoopQuery(),
  } as unknown as SupabaseClient;
}

export const supabase = isSupabaseConfigured
  ? createClient(configuredUrl as string, configuredAnonKey as string)
  : createNoopSupabase();
