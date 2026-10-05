import React, { useEffect, useState } from "react";
export default function OfflineStatus() {
  const [offline, setOffline] = useState(!navigator.onLine),
    [registration, setRegistration] = useState(null),
    [cached, setCached] = useState(Boolean(navigator.serviceWorker?.controller)),
    [error, setError] = useState(false);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    let alive = true,
      reloading = false;
    const controlled = Boolean(navigator.serviceWorker?.controller);
    const change = () => {
      if (controlled && !reloading) {
        reloading = true;
        location.reload();
      } else if (alive) setCached(true);
    };
    navigator.serviceWorker?.addEventListener("controllerchange", change);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (!alive) return;
          setRegistration(reg);
          setCached(Boolean(navigator.serviceWorker.controller));
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (alive && worker.state === "installed") {
                setRegistration({ ...reg, waiting: reg.waiting });
                setCached(
                  !navigator.serviceWorker.controller || Boolean(reg.active),
                );
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
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      navigator.serviceWorker?.removeEventListener("controllerchange", change);
    };
  }, []);
  return (
    <div className="offline-status" role="status">
      {registration?.waiting ? (
        <>
          <span>新版車庫已準備好，草稿和進度會保留。</span>
          <button
            onClick={() => registration.waiting.postMessage("ACTIVATE_UPDATE")}
          >
            更新並重新開啟
          </button>
        </>
      ) : (
        <span>
          {error
            ? "離線下載未完成；連線後可重試。"
            : offline
              ? "目前離線，已下載的車庫仍可遊玩。"
              : cached
                ? "車庫已可離線遊玩。"
                : "正在準備離線車庫…"}
        </span>
      )}
    </div>
  );
}
