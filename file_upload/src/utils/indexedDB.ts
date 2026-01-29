/**
 * IndexedDB 封装：用于存储大文件上传的状态和切片信息
 */
interface UploadRecord {
  fileMd5: string; // 文件唯一标识（MD5）
  fileName: string; // 文件名
  fileSize: number; // 文件总大小
  chunkSize: number; // 单个切片大小
  totalChunks: number; // 总切片数
  uploadedChunks: number[]; // 已上传的切片索引数组
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'cancelled'; // 上传状态
  createTime: number; // 创建时间
  updateTime: number; // 更新时间
}

class UploadDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'BigFileUploadDB';
  private readonly STORE_NAME = 'UploadRecords';
  private readonly VERSION = 1;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.VERSION);

      // 数据库升级（首次创建）
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          // 创建对象仓库，以 fileMd5 为主键
          db.createObjectStore(this.STORE_NAME, { keyPath: 'fileMd5' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`IndexedDB 初始化失败：${(event.target as IDBOpenDBRequest).error?.message}`));
      };
    });
  }

  // 新增/更新上传记录
  async putRecord(record: UploadRecord): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({
        ...record,
        updateTime: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        reject(new Error(`记录保存失败：${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  // 根据 fileMd5 查询记录
  async getRecord(fileMd5: string): Promise<UploadRecord | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(fileMd5);

      request.onsuccess = () => {
        resolve(request.result as UploadRecord | null);
      };
      request.onerror = (event) => {
        reject(new Error(`记录查询失败：${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  // 根据 fileMd5 删除记录（取消上传并清理数据）
  async deleteRecord(fileMd5: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(fileMd5);

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        reject(new Error(`记录删除失败：${(event.target as IDBRequest).error?.message}`));
      };
    });
  }

  // 关闭数据库连接
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// 导出单例实例，避免重复初始化
export const uploadDB = new UploadDB();