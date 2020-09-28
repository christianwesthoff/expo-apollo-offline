import {
  OperationVariables,
  TypedDocumentNode,
  SubscriptionHookOptions,
  getApolloContext,
  QueryDataOptions,
  QueryHookOptions,
  QueryResult,
} from "@apollo/client";
import { QueryData, SubscriptionData } from "@apollo/client/react/data";
import { useDeepMemo } from "@apollo/client/react/hooks/utils/useDeepMemo";
import { DocumentNode } from "graphql";
import {
  useContext,
  useState,
  useRef,
  useEffect,
  useReducer,
  useMemo,
} from "react";
import { changeDocumentType } from "./graphql-utils";

export default function useSubscriptionWithFallback<
  TData = any,
  TVariables = OperationVariables
>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>,
  offline: boolean = false
) {
  const context = useContext(getApolloContext());
  const updatedSubscriptionOptions = options
    ? { ...options, subscription }
    : { subscription };
  const [subscriptionResult, setSubscriptionResult] = useState({
    loading: !updatedSubscriptionOptions.skip,
    error: undefined,
    data: undefined,
  });

  const subscriptionDataRef = useRef<SubscriptionData<TData, TVariables>>();
  function getSubscriptionDataRef() {
    if (!subscriptionDataRef.current) {
      subscriptionDataRef.current = new SubscriptionData<TData, TVariables>({
        options: updatedSubscriptionOptions,
        context,
        setResult: (params: any) => {
          setSubscriptionResult(params);
        },
      });
    }
    return subscriptionDataRef.current;
  }

  const subscriptionData = getSubscriptionDataRef();
  subscriptionData.setOptions(updatedSubscriptionOptions, true);
  subscriptionData.context = context;

  useEffect(() => subscriptionData.afterExecute());
  useEffect(() => subscriptionData.cleanup.bind(subscriptionData), []);

  const [tick, forceUpdate] = useReducer((x) => x + 1, 0);
  const query = useMemo(() => changeDocumentType(subscription, "query"), [
    subscription,
  ]);
  const updatedQueryOptions = options
    ? { ...options, query, fetchPolicy: "cache-only" }
    : { query, fetchPolicy: "cache-only" };

  const queryDataRef = useRef<QueryData<TData, TVariables>>();
  const queryData =
    queryDataRef.current ||
    new QueryData<TData, TVariables>({
      options: updatedQueryOptions as QueryDataOptions<TData, TVariables>,
      context,
      onNewData() {
        forceUpdate();
      },
    });

  queryData.setOptions(updatedQueryOptions);
  queryData.context = context;

  // `onError` and `onCompleted` callback functions will not always have a
  // stable identity, so we'll exclude them from the memoization key to
  // prevent `afterExecute` from being triggered un-necessarily.
  const memo = {
    options: {
      ...updatedQueryOptions,
      onError: undefined,
      onCompleted: undefined,
    } as QueryHookOptions<TData, TVariables>,
    context,
    tick,
    offline,
  };

  const queryResult = useDeepMemo(
    () => (offline ? queryData.execute() : {}),
    memo
  ) as QueryResult<TData, TVariables>;

  useEffect(() => {
    // We only need one instance of the `QueryData` class, so we'll store it
    // as a ref to make it available on subsequent renders.
    if (!queryDataRef.current) {
      queryDataRef.current = queryData;
    }

    return () => queryData.cleanup();
  }, []);

  useEffect(() => queryData.afterExecute(), [queryResult.data]);

  if (!offline) {
    const nextSubscriptionResult = subscriptionData.execute(subscriptionResult);
    return nextSubscriptionResult.data ? nextSubscriptionResult : queryResult;
  }

  return queryResult;
}
