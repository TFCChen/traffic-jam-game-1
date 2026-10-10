import { solveLevel } from "./gameEngine.js";

self.onmessage = ({ data }) => {
  try { self.postMessage({ solution: solveLevel(data) }); }
  catch { self.postMessage({ error: "暫時無法分析這個停車場，請再試一次。" }); }
};
