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

const endpoint = "1emerging-crayfish-72.hasura.app/v1";
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
// const patch = <T>(caller: T) => {
//   const ref = (caller as any)["executeOperation"];
//   (caller as any)["executeOperation"] = (...params: any[]) => {
//     const handler = params[1];
//     return ref.apply(caller, [
//       params[0],
//       (error: any, result: any) => {
//         handler(error, result);
//       },
//     ]);
//   };
// };
// patch(wsClient);

const retryLink = new RetryLink({ attempts: { max: Infinity } });
const managedRetryLink = new ManagedRetryLink({
  attempts: { max: Infinity },
  delay: () => 5000,
});

// // using the ability to split links, you can send data to each link
// // depending on what kind of operation is being sent
const link = ApolloLink.split(
  // split based on operation type
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

const errorLink = onError(
  ({ response, graphQLErrors, networkError, operation: gqlOperation }) => {
    console.log("ERROR");
    if (graphQLErrors) {
      console.log(graphQLErrors);
      graphQLErrors.map(({ message, locations, path }) =>
        console.log(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        )
      );
    }

    if (networkError) {
      console.log(gqlOperation);
      const { kind, operation } = getMainDefinition(gqlOperation.query) as any;
      if (kind === "OperationDefinition" && operation === "subscription") {
        console.log(gqlOperation);
      }

      console.log(`[Network error]: ${networkError}`);
    }
    console.log("response", response);
    if (response) {
      response.errors = undefined;
    }
  }
);

const cache = new InMemoryCache();
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
]);

export const createApolloClient = () =>
  new ApolloClient({
    link: ApolloLink.from([errorLink, link]),
    cache,
  });
