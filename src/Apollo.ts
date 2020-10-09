import {
  NormalizedCacheObject,
  ApolloLink,
  InMemoryCache,
  ApolloClient,
  HttpLink,
} from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import {
  persistCache as persistedApolloCache,
  PersistentStorage,
} from "apollo3-cache-persist";
import { AsyncStorage } from "react-native";
import { setContext } from "@apollo/link-context";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { ManagedRetryLink } from "./extensions/managedRetryLink";
import { RetryLink } from "@apollo/link-retry/lib/retryLink";
import { onError } from "@apollo/link-error";
import persistedFailedOperations, {
  PersistedOperationQueue,
} from "./extensions/persistedFailedOperations";
import { PersistedData } from "apollo3-cache-persist/lib/types";
import { ExpireableStorageAdapter } from "./extensions/expireableStorageAdapter";

const endpoint = "emerging-crayfish-72.hasura.app/v1";
const host = `https://${endpoint}/graphql`;
const wshost = `wss://${endpoint}/graphql`;

const httpAuthLink = setContext((_, { headers }) =>
  Promise.resolve({
    headers: {
      ...headers,
      Authorization: "",
    },
  })
);

const httpLink = ApolloLink.from([
  httpAuthLink,
  new HttpLink({
    uri: host,
  }),
]);

// Create a WebSocket link
const wsClient = new SubscriptionClient(wshost, {
  lazy: true,
  reconnect: true,
  connectionParams: () =>
    Promise.resolve({
      headers: {
        Authorization: "",
      },
    }),
});
const wsLink = new WebSocketLink(wsClient);

const retryLink = new RetryLink({ attempts: { max: Infinity } });
const managedRetryLink = new ManagedRetryLink({
  attempts: { max: Infinity },
  delay: () => 5000,
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = ApolloLink.split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query) as any;
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  ApolloLink.split(
    ({ query }) => {
      const { kind, operation } = getMainDefinition(query) as any;
      return kind === "OperationDefinition" && operation === "query";
    },
    ApolloLink.from([retryLink, httpLink]),
    ApolloLink.from([managedRetryLink, httpLink])
  )
);

const errorLink = onError(({ response, graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    console.log(graphQLErrors);
    graphQLErrors.map(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  }

  if (networkError) {
    console.log(`[Network error]: ${networkError}`);
  }

  if (response) {
    response.errors = undefined;
  }
});

const getStorage = () =>
  window !== undefined && window.localStorage
    ? window.localStorage
    : AsyncStorage;

let gcTimeout;
export const initApolloClient = (
  client: ApolloClient<NormalizedCacheObject>
) => {
  const storage = getStorage();
  const { cache } = client;
  gcTimeout = setTimeout(() => cache.gc(), 5000);
  return Promise.all([
    persistedApolloCache({
      cache,
      storage: new ExpireableStorageAdapter(storage, () => {
        const tmrw = new Date(Date.now());
        tmrw.setDate(tmrw.getDate() + 1);
        tmrw.setHours(0);
        tmrw.setMinutes(0);
        tmrw.setSeconds(0);
        tmrw.setMilliseconds(0);
        return +tmrw;
      }) as PersistentStorage<PersistedData<NormalizedCacheObject>>,
      maxSize: false,
      debug: true,
    }),
    persistedFailedOperations({
      client,
      link: managedRetryLink,
      storage: storage as PersistentStorage<
        PersistedData<PersistedOperationQueue>
      >,
      maxSize: false,
      debug: true,
    }),
  ]);
};

export const createApolloClient = () =>
  new ApolloClient({
    link: ApolloLink.from([errorLink, link]),
    cache: new InMemoryCache(),
    defaultOptions: {},
  });
