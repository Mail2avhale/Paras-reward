// Offline Storage Utility using IndexedDB
const DB_NAME = 'paras-offline-db';
const DB_VERSION = 1;

class OfflineStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Offline queue store
        if (!db.objectStoreNames.contains('offline-queue')) {
          const queueStore = db.createObjectStore('offline-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('timestamp', 'timestamp');
        }

        // Cached data store
        if (!db.objectStoreNames.contains('cached-data')) {
          const dataStore = db.createObjectStore('cached-data', { keyPath: 'key' });
          dataStore.createIndex('timestamp', 'timestamp');
        }

        // User data store
        if (!db.objectStoreNames.contains('user-data')) {
          db.createObjectStore('user-data', { keyPath: 'uid' });
        }

        // Products cache
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'product_id' });
        }

        // Orders cache
        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'order_id' });
          ordersStore.createIndex('user_id', 'user_id');
        }
      };
    });
  }

  async saveData(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const dataWithTimestamp = {
        ...data,
        cachedAt: Date.now(),
      };

      const request = store.put(dataWithTimestamp);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getData(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllData(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteData(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearStore(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Cache user data
  async cacheUserData(userData) {
    return this.saveData('user-data', userData);
  }

  async getCachedUserData(uid) {
    return this.getData('user-data', uid);
  }

  // Cache products
  async cacheProducts(products) {
    if (!this.db) await this.init();

    const promises = products.map((product) => this.saveData('products', product));
    return Promise.all(promises);
  }

  async getCachedProducts() {
    return this.getAllData('products');
  }

  // Cache orders
  async cacheOrders(orders) {
    if (!this.db) await this.init();

    const promises = orders.map((order) => this.saveData('orders', order));
    return Promise.all(promises);
  }

  async getCachedOrders(userId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['orders'], 'readonly');
      const store = transaction.objectStore('orders');
      const index = store.index('user_id');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Queue action for later sync
  async queueAction(action) {
    const queueItem = {
      ...action,
      timestamp: Date.now(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline-queue'], 'readwrite');
      const store = transaction.objectStore('offline-queue');
      const request = store.add(queueItem);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedActions() {
    return this.getAllData('offline-queue');
  }

  async markActionSynced(id) {
    return this.deleteData('offline-queue', id);
  }

  // Generic cache with expiry
  async cacheWithExpiry(key, data, expiryMinutes = 60) {
    const cacheData = {
      key,
      value: data,
      timestamp: Date.now(),
      expiry: Date.now() + expiryMinutes * 60 * 1000,
    };

    return this.saveData('cached-data', cacheData);
  }

  async getCachedWithExpiry(key) {
    const cached = await this.getData('cached-data', key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiry) {
      await this.deleteData('cached-data', key);
      return null;
    }

    return cached.value;
  }
}

// Export singleton instance
const offlineStorage = new OfflineStorage();
export default offlineStorage;
