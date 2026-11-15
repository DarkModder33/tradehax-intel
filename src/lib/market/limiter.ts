/** Caps how many provider requests run at once. */
export class Limiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active += 1;
        task().then(resolve, reject).finally(() => {
          this.active -= 1;
          const next = this.queue.shift();
          if (next) next();
        });
      };
      if (this.active < this.limit) start();
      else this.queue.push(start);
    });
  }
}
