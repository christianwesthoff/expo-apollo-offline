import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { PersistentStorage } from "apollo3-cache-persist";
import { PersistedData, Persistable, Persistor } from "./persistor";
import {
  compileDocument,
  getDocumentBody,
  getDocumentType,
} from "./graphql-utils";
import {
  ManagedRetryLink,
  RetryableOperationManager,
} from "./managedRetryLink";
import { registerListeners } from "./listener-utils";

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

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class OperationAdapter implements Persistable<PersistedOperationQueue> {
  constructor(
    private manager: RetryableOperationManager,
    private apolloClient: ApolloClient<NormalizedCacheObject>
  ) {}
  public extract() {
    const elementsToCache = this.manager.getQueue().map((request) => {
      const { query, variables } = request.getOperation();
      return {
        operation: { query: getDocumentBody(query)!, variables },
        timestamp: request.getTimestamp(),
      };
    });
    if (!elementsToCache.length) return null;
    return elementsToCache;
  }
  public restore(data: PersistedOperationQueue) {
    if (!data || !data.length) return;
    setTimeout(
      () =>
        Promise.all(
          data.map(({ operation }, index) =>
            wait(index * delayInBetween).then(() => {
              const doc = compileDocument(operation.query);
              const docType = getDocumentType(doc);
              switch (docType) {
                case "mutation":
                  this.apolloClient.mutate({
                    mutation: doc,
                    variables: operation.variables,
                  });
                  break;
                case "query":
                  this.apolloClient.query({
                    query: doc,
                    variables: operation.variables,
                  });
                  break;
                case "subscription":
                  this.apolloClient.subscribe({
                    query: doc,
                    variables: operation.variables,
                  });
                  break;
              }
            })
          )
        ),
      initalDelay
    );
  }
}

export default async function persistFailedOperations({
  link,
  client,
  ...options
}: PersistRetryLinkOptions) {
  const manager = link.getManager();
  const persistor = new Persistor({
    key: "apollo-mutation-queue",
    source: new OperationAdapter(manager, client),
    trigger: (trigger) => registerListeners(manager, ["write"], trigger),
    ...options,
  });
  await persistor.restore();
  await persistor.purge();
}
