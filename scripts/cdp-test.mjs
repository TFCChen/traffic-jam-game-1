export async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0,
    session;
  const pending = new Map();
  ws.onmessage = (e) => {
    const r = JSON.parse(e.data),
      p = pending.get(r.id);
    if (p) {
      pending.delete(r.id);
      r.error ? p.reject(Error(r.error.message)) : p.resolve(r.result);
    }
  };
  const send = (method, params = {}, attached = true) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      ws.send(
        JSON.stringify({
          id: key,
          method,
          params,
          ...(attached ? { sessionId: session } : {}),
        }),
      );
    });
  const targets = await send("Target.getTargets", {}, false),
    page = targets.targetInfos.find(
      (t) => t.type === "page" && t.url.startsWith("http://localhost:4173"),
    );
  if (!page) throw Error("Open isolated localhost:4173 tab first");
  session = (
    await send(
      "Target.attachToTarget",
      { targetId: page.targetId, flatten: true },
      false,
    )
  ).sessionId;
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (expression) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw Error(`Timed out: ${expression}`);
  };
  const click = async (text) => {
    await evaluate(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Missing/enabled button '+${JSON.stringify(text)});b.focus({preventScroll:true});b.click();})()`,
    );
    await sleep(100);
  };
  return { send, evaluate, sleep, until, click, close: () => ws.close() };
}
