import { parseCboeChain } from "./cboe-parse";

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<{ payload: unknown; root: string }>) => void) | null;
  postMessage: (data: unknown) => void;
};

const workerScope = (globalThis as { DedicatedWorkerGlobalScope?: new () => object }).DedicatedWorkerGlobalScope;
const inWorker = typeof workerScope === "function" && globalThis instanceof workerScope;
if (inWorker) {
  scope.onmessage = (event) => {
    scope.postMessage(parseCboeChain(event.data.payload, event.data.root));
  };
}
