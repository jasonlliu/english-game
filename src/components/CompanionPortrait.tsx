import { useEffect, useRef, useState } from 'react';
import { createModuleLoader } from '../loading/createModuleLoader';
import type { PetId } from '../rendering/models/types';
const portraitModules = createModuleLoader({
  service: () => import('../rendering/portraits/service'),
});
export default function CompanionPortrait({
  stage = 1,
  petId = 'ember',
}: {
  stage?: number;
  petId?: PetId;
}) {
  const host = useRef<HTMLElement>(null);
  const safeStage = Number.isFinite(stage) ? Math.max(0, Math.min(3, Math.floor(stage))) : 1;
  const key = `${petId}-${safeStage}`;
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState({ key: '', source: '', failed: false });
  useEffect(() => {
    if (!host.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || (result.key === key && result.source)) return;
    const abort = new AbortController();
    setResult({ key, source: '', failed: false });
    portraitModules
      .load('service')
      .then((module) => module.requestPortrait({ petId, stage: safeStage }, abort.signal))
      .then((source) => {
        if (!abort.signal.aborted) setResult({ key, source, failed: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, source: '', failed: true });
      });
    return () => abort.abort();
  }, [visible, key, petId, safeStage]);
  const current = result.key === key ? result : null;
  return (
    <i
      ref={host}
      className="companion-portrait"
      style={{ display: 'inline-grid', placeItems: 'center', fontStyle: 'normal' }}
    >
      {current?.source ? (
        <img
          src={current.source}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span
          className="portrait-fallback"
          aria-hidden="true"
          title={current?.failed ? '头像暂时无法载入，再次显示时会重试' : undefined}
        >
          ✦
        </span>
      )}
    </i>
  );
}
