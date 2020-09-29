import {
  OperationVariables,
  TypedDocumentNode,
  useQuery,
  SubscriptionHookOptions,
} from "@apollo/client";
import { DocumentNode } from "graphql";
import { useEffect, useMemo } from "react";
import { changeDocumentType } from "./graphql-utils";

export function useOfflineSubscription<
  TData = any,
  TVariables = OperationVariables
>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>
) {
  const query = useMemo(() => changeDocumentType(subscription, "query")!, [
    subscription,
  ]);
  const useQueryResult = useQuery(query, {
    ...options,
    fetchPolicy: "cache-only",
  });
  const { subscribeToMore } = useQueryResult;
  const variables = options?.variables;
  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: subscription,
      variables: variables,
      updateQuery: (prev, { subscriptionData }) => {
        const { data } = subscriptionData;
        return data ? { ...data } : prev;
      },
    });
    return () => unsubscribe();
  }, [subscribeToMore, subscription, variables]);
  return useQueryResult;
}
