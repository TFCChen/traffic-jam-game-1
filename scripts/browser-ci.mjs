import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
const evidence = resolve('.browser-checks/ci');
mkdirSync(evidence, { recursive:true });
writeFileSync(join(evidence,'chrome.log'),'');
const profile = mkdtempSync(join(realpathSync(tmpdir()), 'garage-ci-'));
const origin = 'http://localhost:4173';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let launchError;
const preview =
  process.env.GARAGE_PREVIEW_RUNNING === "1"
    ? null
    : spawn(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          "4173",
          "--strictPort",
        ],
        { stdio: "inherit" },
      );
preview?.on('error', error => { launchError=error; });
const chrome = spawn(
  process.env.CHROME_PATH || "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
chrome.on('error', error => { launchError=error; });
for(const stream of [chrome.stdout,chrome.stderr])stream.on('data', chunk => {
  appendFileSync(join(evidence,'chrome.log'),chunk);
});
// Root CDP connection used only to create the test page after both processes
// are ready. A blank startup page avoids racing Vite/3D initialization.
let browserSocket;
async function rootCommand(url,method,params={}) {
  if(!browserSocket){
    browserSocket=new WebSocket(url);
    await new Promise((resolve,reject)=>{
      browserSocket.addEventListener('open',resolve,{once:true});
      browserSocket.addEventListener('error',reject,{once:true});
    });
  }
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{browserSocket.removeEventListener('message',receive);reject(Error(`${method} timed out`));},10000);
    const receive=event=>{
      const message=JSON.parse(event.data);if(message.id!==1)return;
      clearTimeout(timer);browserSocket.removeEventListener('message',receive);
      message.error?reject(Error(message.error.message)):resolve(message.result);
    };
    browserSocket.addEventListener('message',receive);
    browserSocket.send(JSON.stringify({id:1,method,params}));
  });
}
try {
  let url, ready=false, lastProbeError;
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    if(launchError)throw launchError;
    if(chrome.exitCode!==null||chrome.signalCode!==null)throw Error(`Chrome exited before readiness: ${chrome.exitCode??chrome.signalCode}`);
    if(preview&&(preview.exitCode!==null||preview.signalCode!==null))throw Error(`Vite preview exited: ${preview.exitCode??preview.signalCode}`);
    try {
      const [port]=readFileSync(join(profile,'DevToolsActivePort'),'utf8').trim().split('\n');
      if(!/^\d+$/.test(port))throw Error('Invalid DevTools port');
      const response=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(2000)});
      if(!response.ok)throw Error(`DevTools HTTP ${response.status}`);
      const version=await response.json();url=version.webSocketDebuggerUrl;
      if(!url)throw Error('DevTools did not expose browser endpoint');
      const page=await fetch(origin,{signal:AbortSignal.timeout(2000)});
      if(!page.ok)throw Error(`Preview HTTP ${page.status}`);
      writeFileSync(join(evidence,'browser-version.json'),JSON.stringify(version,null,2));
      ready=true;break;
    } catch(error){lastProbeError=error.message;}
    await delay(200);
  }
  if(!ready)throw Error(`Browser/preview readiness exceeded 60s: ${lastProbeError}`);
  console.log('Chrome DevTools and Vite preview ready.');
  await rootCommand(url,'Target.createTarget',{url:origin});
  for (const script of [
    "verify-upgrade.mjs",
    "verify-resilience.mjs",
    "verify-camera.mjs",
    "verify-all-levels.mjs",
  ]) {
    console.log(`::group::${script}`);
    const started=Date.now();
    const child = spawn(process.execPath, [`scripts/${script}`, url], {
      stdio: "inherit",
      env:{...process.env,GARAGE_EVIDENCE_DIR:evidence},
    });
    const code = await new Promise((resolve,reject) => {child.on('error',reject);child.on('exit',resolve);});
    appendFileSync(join(evidence,'stages.jsonl'),JSON.stringify({script,code,durationMs:Date.now()-started})+'\n');
    console.log('::endgroup::');
    if (code !== 0) throw Error(`${script} failed`);
  }
} catch(error){
  writeFileSync(join(evidence,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,chromeExit:chrome.exitCode,chromeSignal:chrome.signalCode,previewExit:preview?.exitCode},null,2));
  console.error(readFileSync(join(evidence,'chrome.log'),'utf8').slice(-8000));
  throw error;
} finally {
  browserSocket?.close();
  chrome.kill();
  preview?.kill();
  // Only the unique profile created by this invocation, never a normal profile.
  await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(2000)]);
  if(dirname(profile)===realpathSync(tmpdir())&&basename(profile).startsWith('garage-ci-')){
    try { rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200}); }
    catch(error) { console.warn(`Test profile cleanup: ${error.message}`); }
  }
}
