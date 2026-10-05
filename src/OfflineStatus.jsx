import React, { useEffect, useRef, useState } from "react";
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
