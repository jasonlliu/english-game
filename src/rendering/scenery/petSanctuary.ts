import * as THREE from 'three';
import type { RegionId } from '../../game/adventure';
import { buildRegionScenery } from './kit';

/** A readable habitat around an encounter, with a clear approach through its centre.
 * Static pieces merge by material; only a bounded set of signature objects animate. */
export function createPetSanctuary(region: RegionId, x: number, z: number) {
  const accent = {
    meadow: '#eab55a',
    water: '#76eced',
    fire: '#ff9c52',
    earth: '#bbdf81',
    steel: '#8ddaff',
    fairy: '#e5acf6',
  }[region];
  return buildRegionScenery(
    region,
    ['#dee4d7', '#667b76', '#283f49', '#695643', accent, '#729264'],
    (k) => {
      const nest = k.origin(x, z);
      nest.name = `pet-sanctuary-${region}`;
      const glow = k.material(accent, {
        emissive: accent,
        emissiveIntensity: 0.4,
        roughness: 0.35,
      });
      const crystal = new THREE.OctahedronGeometry(1);
      const stone = new THREE.DodecahedronGeometry(1, 0);
      const shard = (parent: THREE.Object3D, px: number, py: number, pz: number, size: number) =>
        k.add(parent, crystal, glow, px, py, pz, size * 0.38, size, size * 0.38);
      // Low etchings frame the pet without adding an invisible collision wall.
      k.torus(nest, k.gold, 0, 0.045, 0, 1.75, 0.025, true);
      if (region === 'water') {
        const coral = k.material('#d59194');
        for (const side of [-1, 1]) {
          const fan = new THREE.Group();
          fan.position.set(side * 2.55, 0, -1.65);
          nest.add(fan);
          for (let branch = 0; branch < 5; branch++) {
            const angle = (branch - 2) * 0.26;
            const stem = k.cylinder(
              fan,
              branch % 2 ? coral : k.glass,
              Math.sin(angle) * 0.75,
              0.7,
              0,
              0.05,
              0.12,
              1.7,
              6,
            );
            stem.rotation.z = -angle;
            k.ball(
              fan,
              glow,
              Math.sin(angle) * 1.45,
              1.4 + Math.cos(angle) * 0.3,
              0,
              0.11,
              0.11,
              0.11,
            );
          }
          k.add(nest, stone, k.snow, side * 2.6, 0.2, -1.7, 1.05, 0.4, 0.85);
        }
        const shell = new THREE.Group();
        shell.position.set(0, 0.25, -3.4);
        nest.add(shell);
        for (let rib = 0; rib < 7; rib++) {
          const petal = k.ball(
            shell,
            rib % 2 ? k.ice : k.white,
            (rib - 3) * 0.23,
            0.65,
            0,
            0.22,
            1.1 - Math.abs(rib - 3) * 0.12,
            0.16,
          );
          petal.rotation.z = -(rib - 3) * 0.18;
        }
        const pearl = k.ball(shell, glow, 0, 0.45, 0.35, 0.36, 0.36, 0.36);
        k.animate(pearl, (t) => {
          pearl.position.y = 0.65 + Math.sin(t * 0.9) * 0.16;
        });
      } else if (region === 'fire') {
        for (let i = 0; i < 7; i++) {
          const angle = Math.PI * (0.08 + i / 7);
          const px = Math.cos(angle) * 2.8,
            pz = -Math.sin(angle) * 2.8;
          const h = 0.7 + (i % 3) * 0.45;
          k.cylinder(nest, k.rockDark, px, h / 2, pz, 0.4, 0.58, h, 5);
          shard(nest, px, h + 0.25, pz, 0.5);
          k.torus(nest, glow, px, h * 0.55, pz, 0.43, 0.025, true);
        }
      } else if (region === 'earth') {
        for (const side of [-1, 1]) {
          const rock = k.add(nest, stone, k.stone, side * 2.65, 1.15, -2.3, 1, 1.65, 0.85);
          rock.rotation.z = side * 0.2;
          k.add(nest, stone, k.leaves, side * 2.55, 2.45, -2.3, 0.85, 0.35, 0.75);
          for (let i = 0; i < 3; i++) {
            const gem = shard(
              nest,
              side * (2.1 + i * 0.4),
              0.55 + i * 0.16,
              -2 + i * 0.6,
              0.8 - i * 0.13,
            );
            gem.rotation.z = side * 0.25;
          }
        }
        k.add(nest, stone, k.stone, 0, 2.8, -2.8, 2.65, 0.36, 0.72);
        for (let i = 0; i < 5; i++)
          k.ball(nest, k.leaves, -1.7 + i * 0.8, 3.04, -2.8, 0.54, 0.19, 0.55);
      } else if (region === 'steel') {
        const machine = new THREE.Group();
        machine.position.set(0, 1.9, -3.3);
        nest.add(machine);
        k.cylinder(nest, k.iron, 0, 0.24, -3.3, 1.2, 1.5, 0.48, 8);
        for (let i = 0; i < 2; i++) {
          const orbit = k.torus(machine, i ? glow : k.gold, 0, 0, 0, 1.5 + i * 0.13, 0.065);
          orbit.rotation.y = i ? 0.65 : -0.65;
          k.animate(orbit, (t) => {
            orbit.rotation.x = Math.PI / 5 + t * (i ? -0.13 : 0.1);
          });
        }
        const core = shard(machine, 0, 0, 0, 0.67);
        k.animate(core, (t) => {
          core.rotation.y = t * 0.4;
          core.position.y = Math.sin(t) * 0.1;
        });
        for (const side of [-1, 1]) {
          const blade = k.box(nest, k.iron, side * 2.4, 0.95, -1.8, 0.32, 1.9, 0.38);
          blade.rotation.z = side * 0.35;
          shard(nest, side * 2.65, 1.8, -1.8, 0.25);
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const angle = Math.PI * (0.12 + i * 0.19);
          const px = Math.cos(angle) * 2.8,
            pz = -Math.sin(angle) * 2.8;
          const h = 1.4 + (i % 2) * 0.65;
          k.cylinder(nest, k.white, px, h / 2, pz, 0.045, 0.11, h, 7);
          if (region === 'fairy') {
            k.ball(nest, k.flowerPink, px, h, pz, 0.67, 0.22, 0.67);
            k.ball(nest, glow, px, h + 0.08, pz, 0.3, 0.13, 0.3);
          } else shard(nest, px, h, pz, 0.45);
        }
        if (region === 'fairy') {
          const crescent = k.add(
            nest,
            new THREE.TorusGeometry(1.1, 0.13, 5, 24, Math.PI * 1.5),
            glow,
            0,
            2.4,
            -3.4,
          );
          crescent.rotation.z = -Math.PI / 4;
        }
      }
      // Each habitat has at most six motes; no new objects are allocated per frame.
      for (let i = 0; i < 6; i++) {
        const mote = shard(nest, 0, 0, 0, region === 'water' ? 0.065 : 0.085);
        mote.castShadow = false;
        k.animate(mote, (t) => {
          const a = t * 0.13 + (i * Math.PI) / 3;
          const rise =
            region === 'fire' ? ((t * 0.2 + i / 6) % 1) * 2.3 : 1.15 + Math.sin(t * 0.6 + i) * 0.7;
          mote.position.set(Math.cos(a) * 2.3, 0.3 + rise, Math.sin(a) * 1.8 - 0.8);
          mote.rotation.y = t * 0.5 + i;
        });
      }
      k.onUpdate((t, ready) => {
        glow.emissiveIntensity = (ready ? 0.6 : 0.28) + Math.sin(t * 1.4) * 0.08;
      });
    },
  );
}
