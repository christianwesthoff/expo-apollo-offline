import {
  Operation,
  NextLink,
  ApolloLink,
  Observable,
  FetchResult,
} from "@apollo/client";
import {
  DelayFunctionOptions,
  buildDelayFunction,
} from "@apollo/link-retry/lib/delayFunction";
import {
  RetryFunctionOptions,
  RetryFunction,
  buildRetryFunction,
} from "@apollo/link-retry/lib/retryFunction";

export namespace RetryLink {
  export interface Options {
    /**
     * Configuration for the delay strategy to use, or a custom delay strategy.
     */
    delay?: DelayFunctionOptions;

    /**
     * Configuration for the retry strategy to use, or a custom retry strategy.
     */
    attempts?: RetryFunctionOptions;
  }
}

export interface DelayFunction {
  (count: number): number;
}

class RetryableOperationManager {
  private timerId: number | undefined;
  private queue: RetryableOperation<any>[] = [];
  // private currentOperation: RetryableOperation<any> | undefined;
  private running = false;
  private retryCount = 1;

  constructor(private delayFn: DelayFunction) {}

  public isRunning() {
    return this.running;
  }

  public push(operation: RetryableOperation<any>) {
    this.queue.push(operation);
  }

  public start() {
    if (this.timerId) return;
    this.running = true;
    this.scheduleRetry(this.delayFn(this.retryCount));
  }

  public cancel() {
    clearTimeout(this.timerId);
    this.queue.forEach((op) => op.cancel());
    this.complete();
  }

  public continue() {
    if (!this.queue.length) {
      this.complete();
    } else {
      const retryableOperation = this.queue[0];
      retryableOperation?.start();
    }
  }

  private complete() {
    // this.currentOperation = undefined;
    this.queue = [];
    this.timerId = undefined;
    this.running = false;
    this.retryCount = 1;
  }

  private scheduleRetry(delay: number) {
    if (this.timerId) {
      throw new Error(`RetryLink BUG! Encountered overlapping retries`);
    }

    this.timerId = (setTimeout(() => {
      // this.currentOperation = undefined;
      this.timerId = undefined;
      this.retryCount++;
      this.continue();
    }, delay) as any) as number;
    console.log("[DEBUG] Trigger in ", delay, this.retryCount);
  }
}

/**
 * Tracking and management of operations that may be (or currently are) retried.
 */
class RetryableOperation<TValue = any> {
  private retryCount: number = 0;
  private values: any[] = [];
  private error: any;
  private complete = false;
  private canceled = false;
  private observers: (ZenObservable.Observer<TValue> | null)[] = [];
  private currentSubscription: ZenObservable.Subscription | null = null;
  //   private timerId: number | undefined;

  constructor(
    private manager: RetryableOperationManager,
    private operation: Operation,
    private nextLink: NextLink,
    private retryIf: RetryFunction
  ) {}

  /**
   * Register a new observer for this operation.
   *
   * If the operation has previously emitted other events, they will be
   * immediately triggered for the observer.
   */
  public subscribe(observer: ZenObservable.Observer<TValue>) {
    if (this.canceled) {
      throw new Error(
        `Subscribing to a retryable link that was canceled is not supported`
      );
    }
    this.observers.push(observer);

    // If we've already begun, catch this observer up.
    for (const value of this.values) {
      observer.next!(value);
    }

    if (this.complete) {
      observer.complete!();
    } else if (this.error) {
      observer.error!(this.error);
    }
  }

  /**
   * Remove a previously registered observer from this operation.
   *
   * If no observers remain, the operation will stop retrying, and unsubscribe
   * from its downstream link.
   */
  public unsubscribe(observer: ZenObservable.Observer<TValue>) {
    const index = this.observers.indexOf(observer);
    if (index < 0) {
      throw new Error(
        `RetryLink BUG! Attempting to unsubscribe unknown observer!`
      );
    }
    // Note that we are careful not to change the order of length of the array,
    // as we are often mid-iteration when calling this method.
    this.observers[index] = null;

    // If this is the last observer, we're done.
    if (this.observers.every((o) => o === null)) {
      this.cancel();
    }
  }

  /**
   * Start the initial request.
   */
  public start() {
    // if (this.currentSubscription) return; // Already started.
    this.try();
  }

  /**
   * Stop retrying for the operation, and cancel any in-progress requests.
   */
  public cancel() {
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
    // clearTimeout(this.timerId);
    // this.timerId = undefined;
    this.currentSubscription = null;
    this.canceled = true;
    this.manager.continue();
  }

  private try() {
    this.currentSubscription = this.nextLink(this.operation).subscribe({
      next: this.onNext,
      error: this.onError,
      complete: this.onComplete,
    });
  }

  private onNext = (value: any) => {
    this.values.push(value);
    for (const observer of this.observers) {
      if (!observer) continue;
      observer.next!(value);
    }
  };

  private onComplete = () => {
    this.complete = true;
    for (const observer of this.observers) {
      if (!observer) continue;
      observer.complete!();
    }
    this.manager.continue();
  };

  private onError = async (error: any) => {
    this.retryCount += 1;

    // Should we retry?
    const shouldRetry = await this.retryIf(
      this.retryCount,
      this.operation,
      error
    );
    if (shouldRetry) {
      this.manager.push(this);
      this.manager.start();
      return;
    }

    this.error = error;
    for (const observer of this.observers) {
      if (!observer) continue;
      observer.error!(error);
    }
  };

  //   private scheduleRetry(delay: number) {
  //     if (this.timerId) {
  //       throw new Error(`RetryLink BUG! Encountered overlapping retries`);
  //     }

  //     this.timerId = (setTimeout(() => {
  //       this.timerId = undefined;
  //       this.try();
  //     }, delay) as any) as number;
  //   }
}

export class ManagedRetryLink extends ApolloLink {
  private retryIf: RetryFunction;
  private manager: RetryableOperationManager;

  constructor(options?: RetryLink.Options) {
    super();
    const { attempts, delay } = options || ({} as RetryLink.Options);
    this.retryIf = buildRetryFunction(attempts);
    this.manager = new RetryableOperationManager(
      buildDelayFunction(delay) as DelayFunction
    );
  }

  public request(
    operation: Operation,
    nextLink: NextLink
  ): Observable<FetchResult> {
    const retryable = new RetryableOperation(
      this.manager,
      operation,
      nextLink,
      this.retryIf
    );
    retryable.start();

    return new Observable((observer) => {
      retryable.subscribe(observer);
      return () => {
        retryable.unsubscribe(observer);
      };
    });
  }
}
