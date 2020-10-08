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
import {
  changeDocumentType,
  getDocumentType,
} from "../extensions/graphql-utils";

export type OfflineMutationHookOptions<
  TData = any,
  TVariables = OperationVariables
> = MutationHookOptions<TData, TVariables> & {
  offlineUpdate?: [
    {
      query: DocumentNode;
      variables?: OperationVariables;
      updateQuery: (data: any, variables?: TVariables) => any;
    }
  ];
  optimisticReturn?: (
    variables?: TVariables
  ) => Promise<FetchResult<TData, Record<string, any>, Record<string, any>>>;
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
    async (options1) => {
      if (options?.offlineUpdate) {
        const offlineUpdates = options.offlineUpdate || [];
        await Promise.all(
          offlineUpdates.map(async ({ query, variables, updateQuery }) => {
            const isSubscription = getDocumentType(query) === "subscription";
            let sourceQuery;
            if (isSubscription) {
              sourceQuery = changeDocumentType(query, "query")!;
            } else {
              sourceQuery = query;
            }
            const fromCache = context.client?.cache.readQuery<TData>(
              {
                query: sourceQuery,
                variables,
              },
              true
            );
            const data = updateQuery(
              fromCache ?? ({} as TData),
              options1?.variables
            );
            context.client?.cache.writeQuery({
              query: sourceQuery,
              variables,
              data,
              broadcast: true,
            });
          })
        );
      }
      if (options?.optimisticReturn) {
        return options.optimisticReturn(options1?.variables);
      }
      return fetchResult(options1);
    },
    [fetchResult, options]
  );
  return [offlineFetchResult, mutationResult];
}
