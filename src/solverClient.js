export function solveInBackground(cars, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const worker = new Worker(new URL("./solver.worker.js", import.meta.url), { type: "module" });
    const finish = (callback, value) => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
      callback(value);
    };
    const abort = () => finish(reject, new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => data.error ? finish(reject, new Error(data.error)) : finish(resolve, data.solution);
    worker.onerror = () => finish(reject, new Error("分析暫時無法使用，請重新載入後再試一次。"));
    worker.postMessage(cars);
  });
}
