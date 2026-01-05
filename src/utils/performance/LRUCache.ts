export default class LRUCache<K, V> {
	#cache = new Map<K, V>();
	#maxSize: number;

	constructor(maxSize: number) {
		this.#maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.#cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.#cache.delete(key);
			this.#cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.#cache.has(key)) {
			this.#cache.delete(key);
		} else if (this.#cache.size >= this.#maxSize) {
			// Remove least recently used (first item)
			const firstKey = this.#cache.keys().next().value;
			if (firstKey !== undefined) {
				this.#cache.delete(firstKey);
			}
		}
		this.#cache.set(key, value);
	}

	delete(key: K): boolean {
		return this.#cache.delete(key);
	}

	clear(): void {
		this.#cache.clear();
	}

	keys(): IterableIterator<K> {
		return this.#cache.keys();
	}
}
