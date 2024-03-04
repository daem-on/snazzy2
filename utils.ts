export type Snapshot<T> = {
	value: T;
	update: (value: T) => void;
};

export async function createSnapshot<T>(db: Deno.Kv, key: Deno.KvKey): Promise<Snapshot<T>> {
	const value = (await db.get(key)).value as T;
	if (!value) throw new Error(`No value found for key ${key}`);
	return {
		value,
		update: (value: T) => db.set(key, value)
	};
}