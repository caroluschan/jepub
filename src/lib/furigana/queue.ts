export class FuriganaCancelledError extends Error {
  constructor(message = 'Furigana conversion was cancelled.') {
    super(message);
    this.name = 'FuriganaCancelledError';
  }
}

export class ConversionQueue {
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    const run = this.tail.then(async () => {
      if (generation !== this.generation) {
        throw new FuriganaCancelledError();
      }
      return task();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  cancel(): void {
    this.generation += 1;
  }

  reset(): void {
    this.generation += 1;
    this.tail = Promise.resolve();
  }
}
