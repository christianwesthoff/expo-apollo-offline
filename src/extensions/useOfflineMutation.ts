import {
  OperationVariables,
  TypedDocumentNode,
  MutationHookOptions,
  MutationTuple,
  useMutation,
  MutationFunctionOptions,
  FetchResult,
  getApolloContext,
} from "@apollo/client";
import { useCallback, useContext } from "react";
import { DocumentNode } from "graphql";
import { changeDocumentType, getDocumentType } from "./graphql-utils";

export type OfflineMutationHookOptions<
  TData = any,
  TVariables = OperationVariables
> = MutationHookOptions<TData, TVariables> & {
  offlineUpdate?: [
    {
      query: DocumentNode;
      updateQuery: (data: any, variables?: TVariables) => any;
    }
  ];
};

export function useOfflineMutation<
  TData = any,
  TVariables = OperationVariables
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: OfflineMutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const context = useContext(getApolloContext());
  const [fetchResult, mutationResult] = useMutation(mutation, options);
  const offlineFetchResult = useCallback<
    (
      options1?: MutationFunctionOptions<TData, TVariables>
    ) => Promise<FetchResult<TData>>
  >(
    (options1) => {
      options?.offlineUpdate?.forEach(({ query, updateQuery }) => {
        const isSubscription = getDocumentType(query) === "subscription";
        let sourceQuery;
        if (isSubscription) {
          sourceQuery = changeDocumentType(query, "query");
        } else {
          sourceQuery = query;
        }
        const fromCache = context.client?.cache.readQuery<TData>(
          {
            query: sourceQuery,
            id: "ROOT_QUERY",
          },
          true
        );
        const data = updateQuery(
          fromCache ?? ({} as TData),
          options1?.variables
        );
        context.client?.cache.writeQuery({
          id: "ROOT_QUERY",
          query: sourceQuery,
          data,
          broadcast: true,
        });
        if (isSubscription) {
          context.client?.cache.writeQuery({
            id: "ROOT_SUBSCRIPTION",
            query,
            data,
          });
        }
      });
      return fetchResult(options1);
    },
    [fetchResult, options]
  );
  return [offlineFetchResult, mutationResult];
}
