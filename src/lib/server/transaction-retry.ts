/** Retry the entire rolled-back snapshot, including authorization and audit. */
export async function retrySnapshot<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= 4 || typeof error !== 'object' || error === null ||
          !('code' in error) || error.code !== 'P2034') throw error;
      await new Promise(resolve => setTimeout(resolve, 10 * 2 ** attempt + Math.random() * 20));
    }
  }
}
