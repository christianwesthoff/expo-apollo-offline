import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { PersistentStorage } from "apollo-cache-persist/types";
import { PersistedData, Persistable, Persistor } from "./cache";
import { compileQuery, getDocumentBody } from "./graphql-utils";
import {
  ManagedRetryLink,
  RetryableOperationManager,
} from "./managedRetryLink";

export type PersistedOperation = {
  operation: { query: string; variables: Record<string, any> };
  timestamp: Date;
};

export type PersistedOperationQueue = PersistedOperation[];

export interface PersistRetryLinkOptions {
  client: ApolloClient<NormalizedCacheObject>;
  link: ManagedRetryLink;
  storage: PersistentStorage<PersistedData<PersistedOperationQueue>>;
  debounce?: number;
  trigger?: (fn: () => void) => () => void;
  key: string;
  serialize?: boolean;
  maxSize?: number | false;
  debug?: boolean;
}

const initalDelay = 1000;
const delayInBetween = 200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MutationRestore implements Persistable<PersistedOperationQueue> {
  constructor(
    private manager: RetryableOperationManager,
    private apolloClient: ApolloClient<NormalizedCacheObject>
  ) {}
  public extract() {
    return this.manager.getQueue().map(({ getOperation, getTimestamp }) => {
      const { query, variables } = getOperation();
      return {
        operation: { query: getDocumentBody(query)!, variables },
        timestamp: getTimestamp(),
      };
    });
  }
  public restore(data: PersistedOperationQueue) {
    if (!data || !data.length) return;
    const persistedMutationPromises = Promise.all(
      data.map(({ operation, timestamp }, index) => async () => {
        const mutation = compileQuery(operation.query);
        this.apolloClient.mutate({ mutation, variables: operation.variables });
        // We don't want to chain the requests; maybe can successfully execute without each other so we just wait
        return await wait((index + 1) * delayInBetween);
      })
    );
    setTimeout(persistedMutationPromises, initalDelay);
  }
}

export default async function persistFailedMutations({
  link,
  client,
  ...options
}: PersistRetryLinkOptions) {
  const manager = (link as any)["manager"] as RetryableOperationManager;
  const persistor = new Persistor({
    ...options,
    source: new MutationRestore(manager, client),
    trigger: (trigger) =>
      registerListeners(manager, ["push", "remove", "reset"], trigger),
  });
  return await persistor.persist();
}
