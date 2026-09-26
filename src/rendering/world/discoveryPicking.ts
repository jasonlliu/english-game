import type { Intersection, Material, Mesh, Object3D } from 'three';

/** Raycaster hits are distance sorted; an opaque visible surface blocks everything behind it. */
export function pickDiscoveryId(
  hits: readonly Intersection[],
  availableIds: ReadonlySet<string>,
): string | null {
  for (const hit of hits) {
    let visible = true;
    let discoveryId: unknown;
    for (let object: Object3D | null = hit.object; object; object = object.parent) {
      visible &&= object.visible;
      discoveryId ??= object.userData.discoveryId;
    }
    if (!visible) continue;

    const materials = (hit.object as Mesh).material as Material | Material[] | undefined;
    const material = Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials;
    if (!material?.visible || (material.transparent && material.opacity <= 0)) continue;
    if (typeof discoveryId === 'string' && availableIds.has(discoveryId)) return discoveryId;
    if (!material.transparent) return null;
  }
  return null;
}
