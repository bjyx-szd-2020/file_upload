import SparkMD5 from 'spark-md5';

// 监听主线程消息
self.onmessage = (e) => {
  const { file, chunkSize } = e.data;
  if (!file) {
    self.postMessage({ error: '文件不存在' });
    return;
  }

  const spark = new SparkMD5.ArrayBuffer();
  const fileReader = new FileReader();
  let currentChunk = 0;
  const chunks = Math.ceil(file.size / chunkSize);

  // 读取下一个切片
  const loadNextChunk = () => {
    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    fileReader.readAsArrayBuffer(chunk);
  };

  // 切片读取完成
  fileReader.onload = (e) => {
    spark.append(e.target?.result as ArrayBuffer);
    currentChunk++;

    if (currentChunk < chunks) {
      // 发送进度消息
      self.postMessage({ progress: (currentChunk / chunks) * 100 });
      loadNextChunk();
    } else {
      // 发送 MD5 结果
      const md5 = spark.end();
      self.postMessage({ md5, progress: 100 });
    }
  };

  // 读取失败
  fileReader.onerror = () => {
    self.postMessage({ error: '文件读取失败' });
  };

  // 开始读取第一个切片
  loadNextChunk();
};

// 导出类型（方便主线程调用）
export type MD5WorkerMessage = {
  md5?: string;
  progress?: number;
  error?: string;
};