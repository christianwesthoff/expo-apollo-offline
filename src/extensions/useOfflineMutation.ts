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
import { useDeepMemo } from "@apollo/client/react/hooks/utils/useDeepMemo";

export type OfflineMutationHookOptions<
  TData = any,
  TVariables = OperationVariables
> = MutationHookOptions<TData, TVariables> & {
  offlineUpdate?: [
    {
      query: DocumentNode;
      updateQuery: (data: TData, variables?: TVariables) => TData;
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
  const memoedOptions = useDeepMemo(() => options, options);
  const offlineFetchResult = useCallback<
    (
      options?: MutationFunctionOptions<TData, TVariables>
    ) => Promise<FetchResult<TData>>
  >(
    (options) => {
      if (memoedOptions?.offlineUpdate?.length) {
        memoedOptions.offlineUpdate.forEach(({ query, updateQuery }) => {
          let sourceQuery = query;
          const isSubscription = getDocumentType(query) === "subscription";
          if (isSubscription) {
            sourceQuery = changeDocumentType(query, "query");
          }
          const fromCache = context.client!.cache.readQuery<TData>(
            {
              query: sourceQuery,
              id: "ROOT_QUERY",
            },
            true
          );
          const data = updateQuery(
            fromCache ?? ({} as TData),
            options!.variables
          );
          context.client!.cache.writeQuery({
            id: "ROOT_QUERY",
            query: sourceQuery,
            data,
            broadcast: true,
          });
          if (isSubscription) {
            context.client!.cache.writeQuery({
              id: "ROOT_SUBSCRIPTION",
              query,
              data,
            });
          }
        });
      }
      return fetchResult(options);
    },
    [fetchResult, memoedOptions]
  );
  return [offlineFetchResult, mutationResult];
}
