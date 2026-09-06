/**
 * Simple in-memory task queue to limit concurrent processing.
 */
export class TaskQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Adds a task function to the queue.
   * @param {() => Promise<any>} task - Async function to execute.
   * @returns {Promise<any>}
   */
  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._next();
    });
  }

  _next() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this._next();
      });
  }

  get pending() {
    return this.queue.length;
  }
}
