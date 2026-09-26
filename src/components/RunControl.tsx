import { useEffect, useState } from 'react';

/** Touch can keep one thumb on steering while toggling the same gait as Shift. */
export default function RunControl({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (running: boolean) => void;
}) {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (disabled) setRunning(false);
    onChange(!disabled && running);
  }, [disabled, running, onChange]);
  return (
    <>
      <button
        className="world-run"
        aria-label="切换奔跑"
        aria-pressed={running && !disabled}
        disabled={disabled}
        onClick={() => setRunning((value) => !value)}
      >
        <span aria-hidden="true">»</span>
        {running ? '奔跑中' : '奔跑'}
      </button>
      <style>{`.world-run{display:none;position:absolute;right:106px;bottom:49px;width:58px;height:58px;border:1px solid #fff9;border-radius:50%;color:#fff9e1;background:#244f4266;backdrop-filter:blur(6px);pointer-events:auto;font-size:10px;place-content:center;gap:1px;touch-action:manipulation}.world-run>span{font-size:23px;line-height:23px}.world-run[aria-pressed=true]{background:#68824cdd;border-color:#e6f4b3;box-shadow:0 0 18px #ddeda733}.world-run:disabled{visibility:hidden}@media(pointer:coarse),(max-width:760px){.world-run{display:grid}}`}</style>
    </>
  );
}
