import * as THREE from 'three';
import { RACE_GATES, RACE_START } from '../../../game/fieldActivityRules';
import { getTerrainHeight } from '../../../game/world';
import type { SceneryFrame } from '../types';

/** A small reusable set of gates; no per-frame geometry or downloaded assets. */
export function createMeadowRace() {
  const group = new THREE.Group();
  group.name = 'meadow-race';
  const hoop = new THREE.TorusGeometry(2.8, 0.085, 6, 40);
  const pole = new THREE.CylinderGeometry(0.045, 0.065, 3.6, 6);
  const flag = new THREE.PlaneGeometry(1.1, 0.65, 1, 1);
  const arrow = new THREE.ConeGeometry(0.28, 0.65, 4);
  const warm = new THREE.MeshBasicMaterial({ color: '#ffdb8e', transparent: true, opacity: 0.95 });
  const faint = new THREE.MeshBasicMaterial({
    color: '#a7e8cf',
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const timber = new THREE.MeshStandardMaterial({ color: '#705137', roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({
    color: '#e4a059',
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  const start = new THREE.Group();
  start.position.set(RACE_START.x, getTerrainHeight(RACE_START.x, RACE_START.z), RACE_START.z);
  group.add(start);
  const flags: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(pole, timber);
    post.position.set(side * 3.3, 1.8, 0);
    start.add(post);
    const pennant = new THREE.Mesh(flag, cloth);
    pennant.position.set(side * 3.3 + 0.53, 3.1, 0);
    start.add(pennant);
    flags.push(pennant);
  }
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 5, 16), warm);
  crest.position.set(0, 1.1, 0);
  start.add(crest);
  const gates = RACE_GATES.map((point, i) => {
    const root = new THREE.Group();
    const before = i ? RACE_GATES[i - 1] : RACE_START;
    root.position.set(point.x, getTerrainHeight(point.x, point.z) + 2.8, point.z);
    root.rotation.y = Math.atan2(point.x - before.x, point.z - before.z);
    const ring = new THREE.Mesh(hoop, warm);
    root.add(ring);
    const marker = new THREE.Mesh(arrow, warm);
    marker.position.y = 3.65;
    marker.rotation.z = Math.PI;
    root.add(marker);
    root.visible = false;
    group.add(root);
    return { root, ring, marker };
  });
  let disposed = false;
  return {
    group,
    update(time: number, frame?: SceneryFrame) {
      for (let i = 0; i < flags.length; i++) flags[i].rotation.y = Math.sin(time * 2 + i) * 0.17;
      crest.rotation.y = time * 0.55;
      crest.position.y = 1.1 + Math.sin(time * 2) * 0.12;
      gates.forEach(({ root, ring, marker }, i) => {
        const next = frame?.race?.nextGate ?? -1;
        root.visible = !!frame?.race?.active && (i === next || i === next + 1);
        ring.material = i === next ? warm : faint;
        marker.visible = i === next;
        marker.position.y = 3.65 + Math.sin(time * 4) * 0.15;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of [hoop, pole, flag, arrow, crest.geometry]) geometry.dispose();
      for (const material of [warm, faint, timber, cloth]) material.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
