import * as THREE from 'three';
import { createPet } from '../models/pets';
import type { ModelRig, PetId } from '../models/types';
import { createPortraitQueue } from './queue';
export interface PortraitInput {
  petId: PetId;
  stage: number;
}
let renderer: THREE.WebGLRenderer | undefined;
function releaseRenderer() {
  const current = renderer;
  renderer = undefined;
  if (!current) return;
  try {
    current.dispose();
  } finally {
    current.forceContextLoss();
  }
}
function renderPortrait({ petId, stage }: PortraitInput): string {
  let model: ModelRig | undefined;
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(320, 320);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff8e2', '#8cafa0', 2.4));
    const light = new THREE.DirectionalLight('#fff0cc', 3.5);
    light.position.set(-3, 5, -4);
    scene.add(light);
    const rim = new THREE.DirectionalLight('#9be4d5', 2);
    rim.position.set(3, 3, 3);
    scene.add(rim);
    model = createPet(petId, stage as 0 | 1 | 2 | 3);
    scene.add(model.group);
    model.animate(0, 0, 0);
    const bounds = new THREE.Box3().setFromObject(model.group);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
    const distance =
      Math.max(size.x, size.y, size.z * 0.8) * (petId === 'ember' && stage === 3 ? 1.95 : 2.4);
    if (petId !== 'ember')
      camera.position.set(
        center.x + distance * 0.42,
        center.y + distance * 0.32,
        center.z - distance * 0.95,
      );
    else if (stage >= 2)
      camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z - distance * 0.72,
      );
    else
      camera.position.set(
        center.x + distance * 0.35,
        center.y + distance * 0.22,
        center.z - distance,
      );
    camera.lookAt(center);
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost())
      throw new Error('Portrait rendering context was lost');
    return renderer.domElement.toDataURL('image/png');
  } catch (error) {
    releaseRenderer();
    throw error;
  } finally {
    model?.dispose();
    renderer?.renderLists.dispose();
  }
}
const queue = createPortraitQueue<PortraitInput, string>({
  render: renderPortrait,
  onIdle: releaseRenderer,
  maxEntries: 12,
  maxBytes: 8 * 1024 * 1024,
  sizeOf: (source) => source.length * 2,
});
export function requestPortrait(input: PortraitInput, signal?: AbortSignal): Promise<string> {
  const stage = Number.isFinite(input.stage)
    ? Math.max(0, Math.min(3, Math.floor(input.stage)))
    : 1;
  return queue.request(`${input.petId}-${stage}`, { ...input, stage }, signal);
}
