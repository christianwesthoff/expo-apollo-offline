import { PersistentStorage } from "apollo-cache-persist/types";

export type PersistedData<T> = T | string | null;

export interface PersistOptions<T> {
  source: Persistable<T>;
  storage: PersistentStorage<PersistedData<T>>;
  debounce?: number;
  trigger?: (fn: () => void) => () => void;
  key: string;
  serialize?: boolean;
  maxSize?: number | false;
  debug?: boolean;
}

export interface Persistable<T> {
  extract: () => T;
  restore: (data: T) => void;
}

export type LogLevel = "log" | "warn" | "error";

export type LogLine = [LogLevel, any[]];

export type TriggerUninstallFunction = () => void;

export interface TriggerConfig<T> {
  log: Log<T>;
  persistor: Persistor1<T>;
}

class Trigger<T> {
  debounce: number;
  persistor: Persistor1<T>;
  paused: boolean;
  timeout: any;
  uninstall?: TriggerUninstallFunction;

  static defaultDebounce = 1000;

  constructor({ persistor }: TriggerConfig<T>, options: PersistOptions<T>) {
    const { defaultDebounce } = Trigger;
    const { debounce, trigger } = options;

    this.debounce = debounce != null ? debounce : defaultDebounce;
    this.persistor = persistor;
    this.paused = false;

    if (typeof trigger === "function") {
      this.uninstall = trigger(this.fire);
    } else {
      throw Error(`Unrecognized trigger option: ${trigger}`);
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  remove(): void {
    if (this.uninstall) {
      this.uninstall();
      this.uninstall = undefined;
      this.paused = true;
    }
  }

  fire = () => {
    if (!this.debounce) {
      this.persist();
      return;
    }

    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(this.persist, this.debounce);
  };

  persist = () => {
    if (this.paused) {
      return;
    }

    this.persistor.persist();
  };
}

class Persistable1<T> {
  source: Persistable<T>;
  serialize: boolean;

  constructor(options: PersistOptions<T>) {
    const { source, serialize = true } = options;

    this.source = source;
    this.serialize = serialize;
  }

  extract(): PersistedData<T> {
    let data: PersistedData<T> = this.source.extract();

    if (this.serialize) {
      data = JSON.stringify(data) as string;
    }

    return data;
  }

  restore(data: PersistedData<T>): void {
    if (this.serialize && typeof data === "string") {
      data = JSON.parse(data);
    }

    if (data != null) {
      this.source.restore(data as T);
    }
  }
}

interface PersistorConfig<T> {
  log: Log<T>;
  source: Persistable1<T>;
  storage: Storage<T>;
}

class Persistor1<T> {
  log: Log<T>;
  source: Persistable1<T>;
  storage: Storage<T>;
  maxSize?: number;
  paused: boolean;

  constructor(
    { log, source, storage }: PersistorConfig<T>,
    options: PersistOptions<T>
  ) {
    const { maxSize = 1024 * 1024 } = options;

    this.log = log;
    this.source = source;
    this.storage = storage;
    this.paused = false;

    if (maxSize) {
      this.maxSize = maxSize;
    }
  }

  async persist(): Promise<void> {
    try {
      const data = this.source.extract();

      if (
        this.maxSize != null &&
        typeof data === "string" &&
        data.length > this.maxSize &&
        !this.paused
      ) {
        await this.purge();
        this.paused = true;
        return;
      }

      if (this.paused) {
        return;
      }

      await this.storage.write(data);

      this.log.info(
        typeof data === "string"
          ? `Persisted source of size ${data.length} characters`
          : "Persisted source"
      );
    } catch (error) {
      this.log.error("Error persisting source", error);
      throw error;
    }
  }

  async restore(): Promise<void> {
    try {
      const data = await this.storage.read();

      if (data != null) {
        await this.source.restore(data);

        this.log.info(
          typeof data === "string"
            ? `Restored source of size ${data.length} characters`
            : "Restored source"
        );
      } else {
        this.log.info("No stored source to restore");
      }
    } catch (error) {
      this.log.error("Error restoring source", error);
      throw error;
    }
  }

  async purge(): Promise<void> {
    try {
      await this.storage.purge();
      this.log.info("Purged source storage");
    } catch (error) {
      this.log.error("Error purging source storage", error);
      throw error;
    }
  }
}

export class Persistor<T> {
  log: Log<T>;
  source: Persistable1<T>;
  storage: Storage<T>;
  persistor: Persistor1<T>;
  trigger: Trigger<T>;

  constructor(options: PersistOptions<T>) {
    if (!options.source) {
      throw new Error("No source passed");
    }

    if (!options.storage) {
      throw new Error("No storage provider passed");
    }

    const log = new Log(options);
    const source = new Persistable1(options);
    const storage = new Storage(options);
    const persistor = new Persistor1({ log, source, storage }, options);
    const trigger = new Trigger({ log, persistor }, options);

    this.log = log;
    this.source = source;
    this.storage = storage;
    this.persistor = persistor;
    this.trigger = trigger;
  }

  /**
   * Manual persistence controls.
   */

  persist(): Promise<void> {
    return this.persistor.persist();
  }

  restore(): Promise<void> {
    return this.persistor.restore();
  }

  purge(): Promise<void> {
    return this.persistor.purge();
  }

  /**
   * Trigger controls.
   */

  pause(): void {
    this.trigger.pause();
  }

  resume(): void {
    this.trigger.resume();
  }

  remove(): void {
    this.trigger.remove();
  }

  /**
   * Info accessor.
   */

  getLogs(print = false): Array<LogLine> | void {
    if (print) {
      this.log.tailLogs();
    } else {
      return this.log.getLogs();
    }
  }

  getSize(): Promise<number | null> {
    return this.storage.getSize();
  }
}

export class Storage<T> {
  storage: PersistentStorage<PersistedData<T>>;
  key: string;

  constructor(options: PersistOptions<T>) {
    const { storage, key } = options;

    this.storage = storage;
    this.key = key;
  }

  async read(): Promise<PersistedData<T>> {
    return this.storage.getItem(this.key);
  }

  async write(data: PersistedData<T>): Promise<void> {
    await this.storage.setItem(this.key, data);
  }

  async purge(): Promise<void> {
    await this.storage.removeItem(this.key);
  }

  async getSize(): Promise<number | null> {
    const data = await this.storage.getItem(this.key);

    if (data == null) {
      return 0;
    } else {
      return typeof data === "string" ? data.length : null;
    }
  }
}

export class Log<T> {
  debug: boolean;
  lines: Array<LogLine>;

  static buffer = 30;
  static prefix = "[apollo-source-persist]";

  constructor(options: PersistOptions<T>) {
    const { debug = false } = options;

    this.debug = debug;
    this.lines = [];
  }

  emit(level: LogLevel, message: any[]): void {
    if (level in console) {
      const { prefix } = Log;
      console[level](prefix, ...message);
    }
  }

  tailLogs(): void {
    this.lines.forEach(([level, message]) => this.emit(level, message));
  }

  getLogs(): Array<LogLine> {
    return this.lines;
  }

  write(level: LogLevel, message: any[]): void {
    const { buffer } = Log;

    this.lines = [...this.lines.slice(1 - buffer), [level, message]];

    if (this.debug || level !== "log") {
      this.emit(level, message);
    }
  }

  info(...message: any[]): void {
    this.write("log", message);
  }

  warn(...message: any[]): void {
    this.write("warn", message);
  }

  error(...message: any[]): void {
    this.write("error", message);
  }
}
