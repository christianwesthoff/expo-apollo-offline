import { HttpLink, NormalizedCacheObject, ApolloLink } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { persistCache as persistedApolloCache } from "apollo-cache-persist";
import { PersistentStorage, PersistedData } from "apollo-cache-persist/types";
import { AsyncStorage } from "react-native";
import { onError } from "@apollo/link-error";
import { RetryLink } from "@apollo/link-retry";
import { InMemoryCache1 } from "./extensions/inMemoryCache";
import { ApolloClient1, MutationQueue } from "./extensions/apolloClient";
import persistedMutationQueue from "./extensions/persistedMutationQueue";

const endpoint = "emerging-crayfish-72.hasura.app/v1";
const host = `https://${endpoint}/graphql`;
const wshost = `wss://${endpoint}/graphql`;

const httpLink = new HttpLink({
  uri: host,
  credentials: "include",
});

// Create a WebSocket link:
const wsLink = new WebSocketLink({
  uri: wshost,
  options: {
    reconnect: true,
  },
});

const errorLink = onError(({ response, graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    console.log(graphQLErrors);
    graphQLErrors.map(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  }

  if (networkError) console.log(`[Network error]: ${networkError}`);
  console.log("response", response);
  if (response) {
    response.errors = undefined;
  }
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = new RetryLink({ attempts: { max: Infinity } }).split(
  // split based on operation type
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query) as any;
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  httpLink
);

const cache = new InMemoryCache1();
const mutationQueue = new MutationQueue();
const getStorage = () =>
  (window !== undefined && window.localStorage
    ? window.localStorage
    : AsyncStorage) as PersistentStorage<PersistedData<NormalizedCacheObject>>;

export const waitOnCache = Promise.all([
  persistedApolloCache({
    cache,
    storage: getStorage(),
    maxSize: false,
    debug: true,
  }),
  persistedMutationQueue({
    cache: mutationQueue as any,
    storage: getStorage() as any,
    maxSize: false,
    debug: true,
    key: "apollo-mutation-persist",
  }),
]);

export const createApolloClient = () =>
  new ApolloClient1({
    link: ApolloLink.from([errorLink, link]),
    cache,
    mutationQueue: new MutationQueue(),
  });
