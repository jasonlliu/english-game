import { ArrowLeft, Check, Compass, Gem, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import type { PetId, RegionId } from '../game/adventure';
import { activateTempleSeal, TEMPLE_THEMES } from '../game/temple';
import {
  getTemplePath,
  resolveTempleMovement,
  TEMPLE_SPAWN,
  TEMPLE_TARGETS,
} from '../game/templeWorld';
import type { WorldPoint } from '../game/world';
import { createHero } from '../rendering/models/hero';
import { createPet } from '../rendering/models/pets';
import type { ModelRig } from '../rendering/models/types';
import { createTempleEnvironment } from '../rendering/temple/environment';
import { createTempleLifetime } from '../rendering/temple/lifetime';
interface Props {
  region: RegionId;
  stage: 0 | 1 | 2 | 3;
  companionId: PetId | null;
  paused: boolean;
  completed: boolean;
  onComplete(): void;
  onExit(): void;
}
export default function TempleScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const theme = TEMPLE_THEMES[props.region];
  const [sequence, setSequence] = useState<number[]>(props.completed ? [...theme.order] : []);
  const sequenceRef = useRef(sequence);
  sequenceRef.current = sequence;
  const [near, setNear] = useState<number | null>(null),
    nearRef = useRef<number | null>(null);
  const [message, setMessage] = useState(
    props.completed
      ? '旧日的灯火仍为你亮着。可以自由重访。'
      : '循着碑文的顺序，靠近三座光印并按 E 点亮。',
  );
  const [collapsed, setCollapsed] = useState(false);
  const [unavailable, setUnavailable] = useState(false),
    [retry, setRetry] = useState(0);
  const navigateRef = useRef<(id: number) => void>(() => {}),
    interactRef = useRef<() => void>(() => {});
  const joystick = useRef({ x: 0, z: 0 }),
    stickRef = useRef<HTMLSpanElement>(null);
  interactRef.current = () => {
    if (latest.current.paused || unavailable) return;
    const id = nearRef.current;
    if (id === null) return;
    if (id === 4) {
      latest.current.onExit();
      return;
    }
    if (id === 3) {
      if (sequenceRef.current.length === 3) {
        if (!latest.current.completed) latest.current.onComplete();
        else setMessage('这件遗物已收入收藏，灯火会记得你的来访。');
      } else setMessage('遗物被光幕守护。先依照碑文点亮三座光印。');
      return;
    }
    const result = activateTempleSeal(sequenceRef.current, id, theme.order);
    sequenceRef.current = result.sequence;
    setSequence(result.sequence);
    setMessage(
      result.solved
        ? '光幕消散了！走到殿堂深处，领取遗物。'
        : result.correct
          ? `${theme.sealNames[id]}已亮起。${theme.clue}`
          : '光印熄灭了。没有损失，按碑文顺序再试一次。',
    );
  };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const lifetime = createTempleLifetime();
    const fail = () => {
      lifetime.dispose();
      nearRef.current = null;
      setNear(null);
      setUnavailable(true);
    };
    lifetime.add(() => {
      navigateRef.current = () => {};
      joystick.current = { x: 0, z: 0 };
    });
    setUnavailable(false);
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      lifetime.add(() => {
        try {
          renderer.dispose();
        } finally {
          renderer.forceContextLoss();
          renderer.domElement.remove();
        }
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      element.appendChild(renderer.domElement);
      lifetime.listen(renderer.domElement, 'webglcontextlost', (event: Event) => {
        event.preventDefault();
        fail();
      });
      const environment = createTempleEnvironment(props.region);
      lifetime.add(environment.dispose);
      const { scene, cameraBlockers, clickTarget } = environment;
      const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
      const hero = createHero();
      lifetime.add(hero.dispose);
      scene.add(hero.group);
      let companion: ModelRig | null = null,
        petKey = '';
      lifetime.add(() => companion?.dispose());
      const player = { ...TEMPLE_SPAWN },
        follower = { x: -2, z: 12 };
      let heading = 0,
        yaw = 0,
        pitch = 0.3,
        jump = 0,
        vy = 0,
        time = 0;
      let path: WorldPoint[] = [],
        keys = new Set<string>(),
        drag: {
          x: number;
          y: number;
          startX: number;
          startY: number;
          id: number;
        } | null = null;
      let followerPath: WorldPoint[] = [],
        followerRepathAt = 0;
      const ray = new THREE.Raycaster(),
        mouse = new THREE.Vector2(),
        plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        hit = new THREE.Vector3();
      navigateRef.current = (id) => {
        if (latest.current.paused) return;
        path = getTemplePath(player, TEMPLE_TARGETS[id]);
        if (path.length) {
          clickTarget.position.set(TEMPLE_TARGETS[id].x, 0.16, TEMPLE_TARGETS[id].z);
          clickTarget.visible = true;
          setMessage(
            id < 3
              ? `正在前往${theme.sealNames[id]}光印，靠近后按 E 或点击交互按钮。`
              : id === 3
                ? '正在前往殿堂深处的遗物。'
                : '正在返回殿门。',
          );
        }
      };
      const clear = () => {
        keys.clear();
        joystick.current = { x: 0, z: 0 };
        if (stickRef.current) stickRef.current.style.transform = 'translate(0,0)';
        drag = null;
      };
      const keyDown = (e: KeyboardEvent) => {
        if (latest.current.paused) return;
        if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))
          return;
        if (e.code === 'Space' && (e.target as HTMLElement)?.closest('button,a')) return;
        if (
          [
            'KeyW',
            'KeyA',
            'KeyS',
            'KeyD',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'Space',
            'KeyE',
            'KeyF',
          ].includes(e.code)
        )
          e.preventDefault();
        keys.add(e.code);
        if (e.code === 'KeyE' && !e.repeat) interactRef.current();
        if (e.code === 'KeyF' && !e.repeat) setMessage('殿堂内步行探索，回到旷野后就能骑乘飞行。');
      };
      const keyUp = (e: KeyboardEvent) => keys.delete(e.code);
      const down = (e: PointerEvent) => {
        if (latest.current.paused) return;
        drag = {
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          id: e.pointerId,
        };
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const move = (e: PointerEvent) => {
        if (!drag) return;
        yaw -= (e.clientX - drag.x) * 0.005;
        pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * 0.003, 0.25, 0.95);
        drag.x = e.clientX;
        drag.y = e.clientY;
      };
      const up = (e: PointerEvent) => {
        if (!drag) return;
        if (
          Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6 &&
          !latest.current.paused
        ) {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          );
          ray.setFromCamera(mouse, camera);
          if (ray.ray.intersectPlane(plane, hit)) {
            path = getTemplePath(player, { x: hit.x, z: hit.z });
            if (path.length) {
              clickTarget.position.set(hit.x, 0.16, hit.z);
              clickTarget.visible = true;
            }
          }
        }
        drag = null;
      };
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        if (latest.current.paused) return;
        pitch = THREE.MathUtils.clamp(pitch + e.deltaY * 0.0006, 0.25, 0.95);
      };
      lifetime.listen(renderer.domElement, 'pointerdown', down);
      lifetime.listen(renderer.domElement, 'pointermove', move);
      lifetime.listen(renderer.domElement, 'pointerup', up);
      lifetime.listen(renderer.domElement, 'pointercancel', clear);
      lifetime.listen(renderer.domElement, 'lostpointercapture', clear);
      lifetime.listen(renderer.domElement, 'wheel', wheel, { passive: false });
      lifetime.listen(window, 'keydown', keyDown);
      lifetime.listen(window, 'keyup', keyUp);
      lifetime.listen(window, 'blur', clear);
      lifetime.listen(document, 'visibilitychange', () => {
        if (document.hidden) clear();
      });
      const resize = () => {
        const w = Math.max(1, element.clientWidth),
          h = Math.max(1, element.clientHeight);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      lifetime.add(() => observer.disconnect());
      observer.observe(element);
      resize();
      let frame = 0,
        last = performance.now(),
        lastNear: number | null = null;
      lifetime.add(() => cancelAnimationFrame(frame));
      const targetCamera = new THREE.Vector3(),
        look = new THREE.Vector3(),
        cameraRay = new THREE.Raycaster(),
        cameraDirection = new THREE.Vector3();
      camera.position.set(0, 8, 19);
      const animate = (now: number) => {
        if (lifetime.disposed) return;
        try {
          frame = requestAnimationFrame(animate);
          const dt = Math.max(0.001, Math.min((now - last) / 1000, 0.035));
          last = now;
          const paused = latest.current.paused;
          if (paused) {
            clear();
          } else time += dt;
          const newKey = `${latest.current.companionId}-${latest.current.stage}`;
          if (newKey !== petKey) {
            if (companion) {
              scene.remove(companion.group);
              companion.dispose();
            }
            companion = latest.current.companionId
              ? createPet(latest.current.companionId, latest.current.stage)
              : null;
            if (companion) scene.add(companion.group);
            petKey = newKey;
          }
          let dx = 0,
            dz = 0;
          if (!paused) {
            const lx =
              Number(keys.has('KeyD') || keys.has('ArrowRight')) -
              Number(keys.has('KeyA') || keys.has('ArrowLeft')) +
              joystick.current.x;
            const lz =
              Number(keys.has('KeyS') || keys.has('ArrowDown')) -
              Number(keys.has('KeyW') || keys.has('ArrowUp')) +
              joystick.current.z;
            if (Math.hypot(lx, lz) > 0.08) {
              path = [];
              clickTarget.visible = false;
              dx = lx * Math.cos(yaw) + lz * Math.sin(yaw);
              dz = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
            } else if (path.length) {
              const target = path[0],
                dist = Math.hypot(target.x - player.x, target.z - player.z);
              if (dist < 0.25) {
                path.shift();
                if (!path.length) clickTarget.visible = false;
              } else {
                dx = (target.x - player.x) / dist;
                dz = (target.z - player.z) / dist;
              }
            }
          }
          const magnitude = Math.hypot(dx, dz);
          if (magnitude > 1) {
            dx /= magnitude;
            dz /= magnitude;
          }
          const next = resolveTempleMovement(player, {
            x: player.x + dx * 5.5 * dt,
            z: player.z + dz * 5.5 * dt,
          });
          const moving = Math.hypot(next.x - player.x, next.z - player.z) / dt;
          Object.assign(player, next);
          if (moving > 0.1) {
            const angle = Math.atan2(-dx, -dz);
            heading +=
              Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)) *
              Math.min(1, dt * 12);
          }
          if (!paused) {
            if (keys.has('Space') && jump === 0) vy = 5.3;
            vy -= 14 * dt;
            jump = Math.max(0, jump + vy * dt);
            if (jump === 0) vy = 0;
          }
          hero.animate(time, Math.min(moving / 5.5, 1), jump);
          hero.group.position.set(player.x, 0.14 + jump, player.z);
          hero.group.rotation.y = heading;
          if (companion) {
            let followerSpeed = 0;
            if (!paused) {
              const dist = Math.hypot(player.x - follower.x, player.z - follower.z);
              if (dist > 2.4) {
                // Reuse a safe route between modest refreshes instead of pushing into pillars.
                if (time >= followerRepathAt) {
                  followerPath = getTemplePath(follower, player);
                  followerRepathAt = time + 0.6;
                }
                while (
                  followerPath.length &&
                  Math.hypot(followerPath[0].x - follower.x, followerPath[0].z - follower.z) < 0.12
                )
                  followerPath.shift();
                const target = followerPath[0];
                if (target) {
                  const distance = Math.hypot(target.x - follower.x, target.z - follower.z),
                    step = Math.min(distance, Math.min(7, dist * 1.8) * dt);
                  const nextFollower = resolveTempleMovement(follower, {
                    x: follower.x + ((target.x - follower.x) / distance) * step,
                    z: follower.z + ((target.z - follower.z) / distance) * step,
                  });
                  const movedX = nextFollower.x - follower.x,
                    movedZ = nextFollower.z - follower.z;
                  followerSpeed = Math.hypot(movedX, movedZ) / Math.max(dt, 0.001);
                  Object.assign(follower, nextFollower);
                  if (followerSpeed > 0.05)
                    companion.group.rotation.y = Math.atan2(-movedX, -movedZ);
                }
              } else {
                followerPath = [];
                followerRepathAt = 0;
              }
            }
            companion.group.position.set(follower.x, 0.14, follower.z);
            companion.animate(time, Math.min(followerSpeed / 7, 1));
          }
          const nearIndex =
            TEMPLE_TARGETS.map((p, i) => ({ i, d: Math.hypot(player.x - p.x, player.z - p.z) }))
              .filter((p) => p.d < 2.15)
              .sort((a, b) => a.d - b.d)[0]?.i ?? null;
          if (nearIndex !== lastNear) {
            lastNear = nearIndex;
            nearRef.current = nearIndex;
            setNear(nearIndex);
          }
          environment.update(time, sequenceRef.current, latest.current.completed, dt);
          targetCamera.set(
            player.x + Math.sin(yaw) * 10 * Math.cos(pitch),
            2.8 + Math.sin(pitch) * 8,
            player.z + Math.cos(yaw) * 10 * Math.cos(pitch),
          );
          targetCamera.x = THREE.MathUtils.clamp(targetCamera.x, -10.8, 10.8);
          targetCamera.z = THREE.MathUtils.clamp(targetCamera.z, -14.8, 18);
          look.set(player.x, 1.7, player.z - 0.2);
          cameraDirection.subVectors(targetCamera, look);
          const cameraDistance = cameraDirection.length();
          cameraRay.set(look, cameraDirection.normalize());
          cameraRay.far = cameraDistance;
          const obstruction = cameraRay.intersectObjects(cameraBlockers, false)[0];
          if (obstruction && obstruction.distance < cameraDistance)
            targetCamera
              .copy(look)
              .addScaledVector(cameraDirection, Math.max(1.3, obstruction.distance - 0.3));
          camera.position.lerp(targetCamera, 1 - Math.exp(-dt * 7));
          camera.lookAt(look);
          renderer.render(scene, camera);
        } catch {
          fail();
        }
      };
      frame = requestAnimationFrame(animate);
    } catch {
      fail();
    }
    return lifetime.dispose;
  }, [props.region, retry]);
  useEffect(() => {
    if (props.completed) {
      sequenceRef.current = [...theme.order];
      setSequence([...theme.order]);
    }
  }, [props.completed, theme]);
  const moveStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect(),
      x = event.clientX - r.left - r.width / 2,
      z = event.clientY - r.top - r.height / 2,
      scale = Math.max(1, Math.hypot(x, z) / 32);
    joystick.current = { x: x / scale / 32, z: z / scale / 32 };
    if (stickRef.current)
      stickRef.current.style.transform = `translate(${x / scale}px,${z / scale}px)`;
  };
  const resetStick = () => {
    joystick.current = { x: 0, z: 0 };
    if (stickRef.current) stickRef.current.style.transform = 'translate(0,0)';
  };
  const label =
    near === null
      ? ''
      : near === 4
        ? '走出神庙'
        : near === 3
          ? props.completed
            ? '查看遗物碑文'
            : sequence.length === 3
              ? '领取神庙遗物'
              : '查看封印'
          : sequence.includes(near)
            ? `${theme.sealNames[near]}已点亮`
            : `点亮${theme.sealNames[near]}`;
  return (
    <div className="temple-scene" style={{ '--temple-accent': theme.color } as CSSProperties}>
      <div className="temple-canvas" ref={host} />
      {unavailable && (
        <div
          className="temple-render-fallback"
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            textAlign: 'center',
            gap: 12,
            padding: 24,
            color: '#f4ead1',
            background: '#233744',
          }}
        >
          <strong>神庙场景暂时无法显示</strong>
          <p>已点亮的光印仍然保留，可以重试或返回旷野。</p>
          <button onClick={() => setRetry((value) => value + 1)}>重新载入场景</button>
        </div>
      )}
      {!unavailable && (
        <section className={`temple-objective ${collapsed ? 'collapsed' : ''}`}>
          <button
            className="temple-heading"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
          >
            <span>
              <small>HIDDEN SANCTUARY · 秘境探索</small>
              <strong>{theme.name}</strong>
            </span>
            <b>{props.completed ? <Check size={18} /> : `${sequence.length} / 3`}</b>
          </button>
          {!collapsed && (
            <>
              <p>{theme.clue}</p>
              <div className="temple-lamps">
                {theme.sealNames.map((name, id) => (
                  <button
                    key={name}
                    onClick={() => navigateRef.current(id)}
                    className={sequence.includes(id) ? 'lit' : ''}
                  >
                    <span>{sequence.includes(id) ? <Check size={14} /> : <Gem size={14} />}</span>
                    {name}
                    <small>前往</small>
                  </button>
                ))}
              </div>
              {sequence.length === 3 && (
                <button className="temple-relic-route" onClick={() => navigateRef.current(3)}>
                  <Sparkles size={14} />
                  {props.completed ? '重访遗物台' : `寻找${theme.artifact}`}
                  <span>→</span>
                </button>
              )}
            </>
          )}
        </section>
      )}
      <button
        className="temple-exit"
        onClick={() => {
          if (!props.paused) props.onExit();
        }}
      >
        <ArrowLeft size={15} />
        返回旷野
      </button>
      {!unavailable && (
        <div className="temple-story" role="status">
          <Compass size={15} />
          <span>{message}</span>
        </div>
      )}
      {near !== null && (
        <button className="temple-interact" onClick={() => interactRef.current()}>
          <kbd>E</kbd>
          {label}
        </button>
      )}
      {!unavailable && (
        <div className="temple-controls-note">
          WASD 移动 · 拖动视角 · E 交互 · 点击光印名称自动带路
        </div>
      )}
      <div
        style={unavailable ? { display: 'none' } : undefined}
        className="temple-joystick"
        aria-label="室内移动摇杆"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveStick(e);
        }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        onLostPointerCapture={resetStick}
      >
        <span ref={stickRef} />
      </div>
    </div>
  );
}
