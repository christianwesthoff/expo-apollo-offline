import {
  OperationVariables,
  TypedDocumentNode,
  MutationHookOptions,
  MutationTuple,
  getApolloContext,
  MutationFunctionOptions,
} from "@apollo/client";
import { MutationData } from "@apollo/client/react/data";
import { useDeepMemo } from "@apollo/client/react/hooks/utils/useDeepMemo";
import { DocumentNode } from "graphql";
import { useContext, useState, useRef, useEffect } from "react";
import { changeDocumentType, getDocumentType } from "./graphql-utils";

export type OfflineMutationOptions<
  TData = any,
  TVariables = OperationVariables
> = {
  query: DocumentNode;
  offlineUpdate: (data: TData, variables: TVariables) => TData;
};

export function useMutationWithFallback<
  TData = any,
  TVariables = OperationVariables
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: MutationHookOptions<TData, TVariables>,
  offline: boolean = false,
  offlineOptions?: OfflineMutationOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const context = useContext(getApolloContext());
  const [result, setResult] = useState({ called: false, loading: false });
  const updatedOptions = options ? { ...options, mutation } : { mutation };

  const mutationDataRef = useRef<MutationData<TData, TVariables>>();
  function getMutationDataRef() {
    if (!mutationDataRef.current) {
      mutationDataRef.current = new MutationData<TData, TVariables>({
        options: updatedOptions,
        context,
        result,
        setResult,
      });
    }
    return mutationDataRef.current;
  }

  const mutationData = getMutationDataRef();
  mutationData.setOptions(updatedOptions);
  mutationData.context = context;

  useEffect(() => mutationData.afterExecute());

  const memo = {
    options: {
      ...updatedOptions,
      onError: undefined,
      onCompleted: undefined,
    } as MutationHookOptions<TData, TVariables>,
    context,
    offline,
  };

  const cacheMutation = useDeepMemo(
    () =>
      (offline && offlineOptions
        ? [
            (options: MutationFunctionOptions<any, any>) => {
              // TODO: push to queue
              const originDocumentType = getDocumentType(offlineOptions.query);
              const query = changeDocumentType(offlineOptions.query, "query");
              const fromCache = context.client!.cache.readQuery<TData>(
                {
                  query,
                  id: "ROOT_QUERY",
                },
                true
              );
              const data = offlineOptions.offlineUpdate(
                fromCache ?? ({} as TData),
                options.variables
              );
              context.client!.cache.writeQuery({
                id: "ROOT_QUERY",
                query,
                data,
                broadcast: true,
              });
              // if (originDocumentType === "subscription") {
              //   context.client!.writeQuery({
              //     id: "ROOT_SUBSCRIPTION",
              //     query,
              //     data,
              //   });
              // }
              return Promise.resolve({});
            },
            {},
          ]
        : {}) as MutationTuple<TData, TVariables>,
    memo
  );

  if (!offline) return mutationData.execute(result);

  return cacheMutation;
}
