import { MutationQueue } from "./apolloClient";
import { CacheOptions, CachePersistor } from "./cache";

const createTrigger = <T>(caller: T, name: string) => (
  callback: () => void
) => {
  const fn = (caller as any)[name];
  (caller as any)[name] = (...args: any[]) => {
    callback();
    fn(...args);
  };
  return fn;
};

export default (options: CacheOptions<MutationQueue<any, any>>) => {
  const persistor = new CachePersistor({
    ...options,
    trigger: createTrigger(options.cache, "write"),
  });
  return persistor.restore();
};
