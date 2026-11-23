/**
 * Global Concurrency & Queue Manager for Video Generations
 * Manages up to MAX_CONCURRENT_JOBS parallel generations on Higgsfield Ultra Plan
 */
export class QueueService {
  static MAX_CONCURRENT = 12; // Safe parallel slots (Higgsfield limit is 16)
  static activeCount = 0;
  static queue = [];

  /**
   * Enqueue a generation task
   * @param {Object} options
   * @param {string} options.userId
   * @param {Function} options.taskFn - Async function executing generation
   * @param {Function} options.onQueueWaiting - Callback if placed in queue (passes position)
   * @param {Function} options.onStart - Callback when job begins execution
   */
  static enqueue({ userId, taskFn, onQueueWaiting, onStart }) {
    return new Promise((resolve, reject) => {
      const job = {
        id: Math.random().toString(36).substring(2, 9),
        userId,
        taskFn,
        onQueueWaiting,
        onStart,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      if (this.activeCount < this.MAX_CONCURRENT) {
        // Free slot available, run immediately
        this.runJob(job);
      } else {
        // All slots full, add to queue
        this.queue.push(job);
        const position = this.queue.length;
        console.log(`📋 Queue position #${position} assigned to User ${userId}`);
        if (typeof onQueueWaiting === 'function') {
          onQueueWaiting(position);
        }
      }
    });
  }

  static async runJob(job) {
    this.activeCount++;
    console.log(`⚡ Slot claimed! Active jobs: ${this.activeCount}/${this.MAX_CONCURRENT}`);

    if (typeof job.onStart === 'function') {
      try {
        job.onStart();
      } catch (e) {
        console.warn('onStart error:', e.message);
      }
    }

    try {
      const result = await job.taskFn();
      job.resolve(result);
    } catch (err) {
      job.reject(err);
    } finally {
      this.activeCount--;
      console.log(`✅ Slot freed! Active jobs: ${this.activeCount}/${this.MAX_CONCURRENT}`);
      this.processNext();
    }
  }

  static processNext() {
    if (this.activeCount < this.MAX_CONCURRENT && this.queue.length > 0) {
      const nextJob = this.queue.shift();
      // Notify remaining jobs in queue about updated positions
      this.queue.forEach((j, index) => {
        if (typeof j.onQueueWaiting === 'function') {
          j.onQueueWaiting(index + 1);
        }
      });
      this.runJob(nextJob);
    }
  }

  static getStatus() {
    return {
      active: this.activeCount,
      max: this.MAX_CONCURRENT,
      queued: this.queue.length,
    };
  }
}
