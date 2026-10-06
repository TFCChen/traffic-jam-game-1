import React, { useEffect, useRef, useState } from "react";

export function PwaVersion() {
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [waiting, setWaiting] = useState(null);
  const mounted = useRef(true);
  useEffect(()=>{ mounted.current=true;return()=>{mounted.current=false;}; },[]);
  async function check() {
    setBusy(true);setWaiting(null);setStatus('正在檢查更新…');
    try {
      const response=await fetch(`/version.json?check=${Date.now()}`, {cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Version unavailable');
      const latest=await response.json();
      if(typeof latest.version!=='string')throw new Error('Invalid version');
      if(latest.version===__APP_VERSION__) {
        if(mounted.current)setStatus('已是最新版');
      } else {
        const reg=await navigator.serviceWorker?.getRegistration();
        if(!reg)throw new Error('Worker unavailable');
        await reg.update();
        if(reg.installing)await new Promise((resolve,reject)=>{
          const worker=reg.installing;
          const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('statechange',change);};
          const change=()=>{if(worker.state==='installed'||worker.state==='activated'){cleanup();resolve();}else if(worker.state==='redundant'){cleanup();reject(new Error('Download failed'));}};
          const timer=setTimeout(()=>{cleanup();reject(new Error('Download timeout'));},30000);
          worker.addEventListener('statechange',change);change();
        });
        if(mounted.current){setWaiting(reg.waiting||{postMessage:()=>location.reload()});setStatus(`新版 ${latest.version} 已準備好`);}
      }
    } catch {
      if(mounted.current)setStatus(navigator.onLine?'暫時無法確認版本，請稍後重試':'目前離線，連線後再檢查');
    } finally {if(mounted.current)setBusy(false);}
  }
  return <div className="pwa-version">
    <span>版本 {__APP_VERSION__}{import.meta.env.DEV?' · 本機開發版':''}</span>
    {!import.meta.env.DEV&&<button disabled={busy} onClick={waiting?()=>waiting.postMessage('ACTIVATE_UPDATE'):check}>{waiting?'更新並重新開啟':busy?'檢查中…':'檢查更新'}</button>}
    {status&&<span role="status">{status}</span>}
  </div>;
}

export default function OfflineStatus() {
  const updateRequested = useRef(false);
  const [registration, setRegistration] = useState(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true,
      reloading = false;
    let controlled = Boolean(navigator.serviceWorker?.controller);
    const change = () => {
      if ((controlled || updateRequested.current) && !reloading) {
        reloading = true;
        location.reload();
      } else if (alive) {
        controlled = true;
        setRegistration(null);
      }
    };
    navigator.serviceWorker?.addEventListener("controllerchange", change);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (!alive) return;
          setRegistration(reg);
          reg.update().catch(() => {});
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (alive && worker.state === "installed") {
                setRegistration({ ...reg, waiting: reg.waiting });
              }
              if (alive && worker.state === "redundant") setError(true);
            });
          });
        })
        .catch(() => {
          if (alive) setError(true);
        });
    }
    return () => {
      alive = false;
      navigator.serviceWorker?.removeEventListener("controllerchange", change);
    };
  }, []);
  if (!registration?.waiting && !error) return null;
  return (
    <div className="offline-status" role="status">
      {registration?.waiting ? (
        <>
          <span>新版車庫已準備好，草稿和進度會保留。</span>
          <button
            onClick={() => {
              updateRequested.current = true;
              registration.waiting.postMessage("ACTIVATE_UPDATE");
            }}
          >
            更新並重新開啟
          </button>
        </>
      ) : (
        <span>
          離線下載未完成；連線後可重試。
        </span>
      )}
    </div>
  );
}
