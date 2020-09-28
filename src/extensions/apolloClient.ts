import {
  ApolloClient,
  ApolloClientOptions,
  DocumentNode,
  TypedDocumentNode,
} from "@apollo/client";

export type MutationOperation<TData, TVariables> = {
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables?: TVariables;
};

export class MutationQueue<TData = any, TVariables = any> {
  private queue: Array<MutationOperation<TData, TVariables>>;

  constructor() {
    this.queue = [];
  }

  public write(operation: MutationOperation<TData, TVariables>): void {
    this.queue.push(operation);
  }

  public clear(): void {
    this.queue = [];
  }

  public extract(): Array<MutationOperation<TData, TVariables>> {
    return this.queue;
  }

  public restore(data: Array<MutationOperation<TData, TVariables>>): void {
    this.queue = data || [];
  }
}

export type ApolloClientOptions1<TCacheShape> = ApolloClientOptions<
  TCacheShape
> & {
  mutationQueue: MutationQueue<any, any>;
};

export class ApolloClient1<TCacheShape> extends ApolloClient<TCacheShape> {
  public mutationQueue: MutationQueue<any, any>;

  constructor(options: ApolloClientOptions1<TCacheShape>) {
    super(options);
    this.mutationQueue = options.mutationQueue;
    console.log(this.mutationQueue);
  }
}
