import {
  NormalizedCacheObject,
  ApolloLink,
  InMemoryCache,
  ApolloClient,
  HttpLink,
} from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { persistCache as persistedApolloCache } from "apollo-cache-persist";
import { PersistentStorage, PersistedData } from "apollo-cache-persist/types";
import { AsyncStorage } from "react-native";
import { setContext } from "@apollo/link-context";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { ManagedRetryLink } from "./extensions/managedRetryLink";
import { RetryLink } from "@apollo/link-retry/lib/retryLink";
import { onError } from "@apollo/link-error";
import persistedFailedOperations, {
  PersistedOperationQueue,
} from "./extensions/persistedFailedOperations";

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
    // credentials: "include",
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
  console.log("response", response);
  if (response) {
    response.errors = undefined;
  }
});

const cache = new InMemoryCache();
const getStorage = () =>
  (window !== undefined && window.localStorage
    ? window.localStorage
    : AsyncStorage) as PersistentStorage<PersistedData<NormalizedCacheObject>> &
    PersistentStorage<PersistedData<PersistedOperationQueue>>;

export const initApolloClient = (
  client: ApolloClient<NormalizedCacheObject>
) => {
  const storage = getStorage();
  return Promise.all([
    persistedApolloCache({
      cache,
      storage,
      maxSize: false,
      debug: true,
    }),
    persistedFailedOperations({
      client,
      link: managedRetryLink,
      storage,
      maxSize: false,
      debug: true,
    }),
  ]);
};

export const createApolloClient = () =>
  new ApolloClient({
    link: ApolloLink.from([errorLink, link]),
    cache,
    defaultOptions: {},
  });
