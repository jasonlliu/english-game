import { Component, useEffect, useState, type ReactNode } from 'react';

export function LoadingView({ label = '正在准备风景…' }: { label?: string }) {
  return (
    <div className="loading-view" role="status" aria-live="polite">
      <span className="loading-orbit" aria-hidden="true">
        ✧
      </span>
      <p>{label}</p>
    </div>
  );
}

function LoadFailure({ retry }: { retry(): void }) {
  return (
    <div className="loading-view loading-failed" role="alert">
      <span aria-hidden="true">✧</span>
      <h2>暂时没能打开这里</h2>
      <p>可以重新加载或刷新页面，旅程进度会保留。</p>
      <button onClick={retry}>重新加载</button>
      <button className="reload-page" onClick={() => window.location.reload()}>
        刷新页面
      </button>
    </div>
  );
}

class ViewBoundary extends Component<{ children: ReactNode; retry(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('Unable to initialize view', error);
  }
  render() {
    return this.state.failed ? <LoadFailure retry={this.props.retry} /> : this.props.children;
  }
}

/** A view owns its load request; stale resolutions cannot mount an exited scene. */
export default function AsyncView<T>({
  load,
  children,
  label,
}: {
  load(): Promise<T>;
  children(value: T): ReactNode;
  label?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    loader: typeof load;
    attempt: number;
    value?: T;
    failed?: boolean;
  }>();
  useEffect(() => {
    let active = true;
    void load().then(
      (value) => {
        if (active) setState({ loader: load, attempt, value });
      },
      (error) => {
        if (active) {
          console.error('Unable to load view', error);
          setState({ loader: load, attempt, failed: true });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt]);
  const retry = () => setAttempt((value) => value + 1);
  if (!state || state.loader !== load || state.attempt !== attempt)
    return <LoadingView label={label} />;
  if (state.failed) return <LoadFailure retry={retry} />;
  return (
    <ViewBoundary key={attempt} retry={retry}>
      {children(state.value!)}
    </ViewBoundary>
  );
}
