import { Cache, InMemoryCache, Reference } from "@apollo/client/cache";

export class InMemoryCache1 extends InMemoryCache {
  public write(options: Cache.WriteOptions): Reference | undefined {
    const result = super.write(options);
    if (options.dataId === "ROOT_SUBSCRIPTION") {
      super.write({ ...options, dataId: "ROOT_QUERY" });
    }
    return result;
  }
}
