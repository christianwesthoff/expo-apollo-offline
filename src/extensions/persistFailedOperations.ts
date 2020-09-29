import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { PersistentStorage } from "apollo-cache-persist/types";
import { PersistedData, Persistable, Persistor } from "./cache";
import {
  compileQuery,
  getDocumentBody,
  getDocumentType,
} from "./graphql-utils";
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
  serialize?: boolean;
  maxSize?: number | false;
  debug?: boolean;
}

const initalDelay = 1000;
const delayInBetween = 200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class OperationRestore implements Persistable<PersistedOperationQueue> {
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
      data.map(({ operation }, index) => async () => {
        await wait(index * delayInBetween);
        const query = compileQuery(operation.query);
        const docType = getDocumentType(query);
        switch (docType) {
          case "mutation":
            this.apolloClient.mutate({
              mutation: query,
              variables: operation.variables,
            });
            break;
          case "query":
            this.apolloClient.query({ query, variables: operation.variables });
            break;
          case "subscription":
            this.apolloClient.subscribe({
              query,
              variables: operation.variables,
            });
            break;
        }
        // We don't want to chain the requests; maybe can successfully execute without each other so we just wait
      })
    );
    setTimeout(persistedMutationPromises, initalDelay);
  }
}

export default async function persistFailedOperations({
  link,
  client,
  ...options
}: PersistRetryLinkOptions) {
  const manager = (link as any)["manager"] as RetryableOperationManager;
  const persistor = new Persistor({
    key: "apollo-mutation-queue",
    ...options,
    source: new OperationRestore(manager, client),
    trigger: (trigger) =>
      registerListeners(manager, ["push", "remove", "reset"], trigger),
  });
  return await persistor.persist();
}
