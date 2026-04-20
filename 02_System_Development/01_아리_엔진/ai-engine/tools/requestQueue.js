class RequestQueue {
  constructor(maxRPM = 14) { // 15 RPM 한계에서 1 여유
    this.queue = [];
    this.timestamps = [];
    this.maxRPM = maxRPM;
    this.processing = false;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._process();
    });
  }

  async _process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      // Keep only timestamps from the last 60 seconds
      this.timestamps = this.timestamps.filter(t => now - t < 60_000);

      if (this.timestamps.length >= this.maxRPM) {
        // Wait until the oldest request in the window is older than 60 seconds
        const waitMs = 60_000 - (now - this.timestamps[0]) + 100;
        console.warn(`[RequestQueue] RPM 한계 도달. API 보호를 위해 ${Math.ceil(waitMs/1000)}초 대기...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue; // Re-evaluate timestamps after waiting
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.timestamps.push(Date.now());

      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }
    this.processing = false;
  }
}

export default new RequestQueue();
