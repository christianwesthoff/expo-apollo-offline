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

export interface OfflineMutationUpdateOptions<
  TQueryData = any,
  TQueryVariables = any,
  TMutationVariables = any,
  TAdditionalVariables = any
> {
  query: DocumentNode | TypedDocumentNode<TQueryData, TQueryVariables>;
  updateQuery: (
    data: TQueryData,
    variables: TQueryVariables
  ) => TQueryData | Promise<TQueryData>;
  transformVariables?: (
    variables?: TMutationVariables & TAdditionalVariables
  ) => TQueryVariables | Promise<TQueryVariables>;
  additionalVariables?: TAdditionalVariables;
}

export type OfflineMutationHookOptions<
  TData = any,
  TVariables = OperationVariables
> = MutationHookOptions<TData, TVariables> & {
  offlineUpdate?: OfflineMutationUpdateOptions<any, any, TVariables, any>[];
  optimisticReturn?: (
    variables?: TVariables,
    fetchResult?: Promise<
      FetchResult<TData, Record<string, any>, Record<string, any>>
    >
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
      const client = context.client;
      const mutationVariables = options1?.variables;
      if (client && options?.offlineUpdate?.length) {
        const offlineUpdate = options.offlineUpdate;
        await Promise.all(
          offlineUpdate.map(
            async ({
              query,
              transformVariables,
              additionalVariables,
              updateQuery,
            }) => {
              const isSubscription = getDocumentType(query) === "subscription";
              const source = isSubscription
                ? changeDocumentType(query, "query")!
                : query;
              const queryVariables = transformVariables
                ? await transformVariables({
                    ...mutationVariables,
                    ...additionalVariables,
                  })
                : additionalVariables;
              const fromCache = client.cache.readQuery<TData>(
                {
                  query: source,
                  variables: queryVariables,
                },
                true
              );
              const data = await updateQuery(
                fromCache ?? ({} as TData),
                mutationVariables
              );
              client.cache.writeQuery({
                query: source,
                variables: queryVariables,
                data,
                broadcast: true,
              });
            }
          )
        );
      }
      if (options?.optimisticReturn) {
        return options.optimisticReturn(
          mutationVariables,
          fetchResult(options1)
        );
      }
      return fetchResult(options1);
    },
    [fetchResult, options, context]
  );
  return [offlineFetchResult, mutationResult];
}
