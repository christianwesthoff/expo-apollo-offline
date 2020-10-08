export interface StorageInterface {
  getItem: (
    key: string
  ) => Promise<string | null | undefined> | string | null | undefined;
  setItem: (key: string, data: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export type ExpiresFn = (data?: string) => number;

export class ExpireableStorageAdapter implements StorageInterface {
  constructor(
    private storage: StorageInterface,
    private expiresAt: ExpiresFn
  ) {}

  private static re = /{"data":"(.*)","expiresAt":(\d+)}/g;

  private transformFrom(data: string) {
    const match = ExpireableStorageAdapter.re.exec(data);
    if (!match || match.length !== 3) return;
    return { data: match[1], expiresAt: Number(match[2]) };
  }

  private transformTo(data: string, expiresAt: number) {
    return JSON.stringify({ data, expiresAt });
  }

  async getItem(key: string) {
    const result = await this.storage.getItem(key);
    if (!result) return null;
    const { data, expiresAt } = this.transformFrom(result)!;
    if (expiresAt >= Date.now()) return null;
    return data;
  }
  async setItem(key: string, data: string) {
    return await this.storage.setItem(
      key,
      this.transformTo(data, this.expiresAt(data))
    );
  }
  async removeItem(key: string) {
    return await this.storage.removeItem(key);
  }
}
