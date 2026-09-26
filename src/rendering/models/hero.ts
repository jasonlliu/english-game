import * as THREE from 'three';
import { modelKit } from './modelKit';
import type { ModelRig, Point } from './types';
/** Original six-head-tall sky ranger; the scene owns world position and rotation. */
export function createHero(): ModelRig {
  const k = modelKit();
  try {
    const { group, rig, soft, material, pivot, tube, tapered, mesh } = k;
    group.name = 'silver-tide-ranger';
    const skin = material('#d9ab8b', { roughness: 0.74 });
    const skinLight = material('#e4bea0', { roughness: 0.73 });
    const navy = material('#19354e');
    const blue = material('#315870');
    const dark = material('#1a2639', { roughness: 0.86 });
    const ivory = material('#e9e5d1', { side: THREE.DoubleSide, roughness: 0.84 });
    const gold = material('#c5a974', { roughness: 0.4, metalness: 0.57 });
    const leather = material('#4b4340', { roughness: 0.86 });
    const steel = material('#7594a2', { metalness: 0.43, roughness: 0.42 });
    const silverHair = material('#aebbc7', { roughness: 0.69 });
    const hairShade = material('#6d8196', { roughness: 0.76 });
    const hairLight = material('#d5dde1', { roughness: 0.68 });
    const teal = material('#69c8cc', {
      emissive: '#30868e',
      emissiveIntensity: 0.2,
      roughness: 0.34,
    });
    const cloakMaterial = material('#24465f', { side: THREE.DoubleSide, roughness: 0.88 });
    // Lofted anatomical and tailored cross-sections replace the old capsule stacks.
    type Section = [number, number, number, number]; // height, half-width, half-depth, depth offset
    function profile(
      parent: THREE.Object3D,
      mat: THREE.Material,
      sections: Section[],
      radial = 24,
    ) {
      const segments = Math.max(16, (sections.length - 1) * 4);
      const vertices: number[] = [];
      const indices: number[] = [];
      const cubic = (a: number, b: number, c: number, d: number, t: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (-a + 3 * b - 3 * c + d) * t * t * t);
      for (let i = 0; i <= segments; i += 1) {
        const at = (i / segments) * (sections.length - 1);
        const n = Math.min(Math.floor(at), sections.length - 2);
        const f = at - n;
        const a = sections[Math.max(0, n - 1)];
        const b = sections[n];
        const c = sections[n + 1];
        const d = sections[Math.min(sections.length - 1, n + 2)];
        const y = THREE.MathUtils.lerp(b[0], c[0], f);
        const w = Math.max(0.003, cubic(a[1], b[1], c[1], d[1], f));
        const depth = Math.max(0.003, cubic(a[2], b[2], c[2], d[2], f));
        const z = cubic(a[3], b[3], c[3], d[3], f);
        for (let j = 0; j <= radial; j += 1) {
          const angle = (j / radial) * Math.PI * 2;
          vertices.push(Math.sin(angle) * w, y, Math.cos(angle) * depth + z);
          if (i < segments && j < radial) {
            const v = i * (radial + 1) + j;
            indices.push(v, v + 1, v + radial + 1, v + 1, v + radial + 2, v + radial + 1);
          }
        }
      }
      for (const [row, section, reverse] of [
        [0, sections[0], true],
        [segments, sections[sections.length - 1], false],
      ] as const) {
        const center = vertices.length / 3;
        vertices.push(0, section[0], section[3]);
        for (let j = 0; j < radial; j += 1) {
          const a = row * (radial + 1) + j;
          indices.push(center, reverse ? a + 1 : a, reverse ? a : a + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return mesh(parent, geometry, mat);
    }
    function panel(
      parent: THREE.Object3D,
      mat: THREE.Material,
      points: Array<[number, number]>,
      z: number,
      depth = 0.012,
    ) {
      const shape = new THREE.Shape();
      points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
      shape.closePath();
      return mesh(
        parent,
        new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 0.008,
          bevelSize: 0.009,
          bevelSegments: 2,
          curveSegments: 8,
        }),
        mat,
        [0, 0, z],
      );
    }
    profile(rig, dark, [
      [1.34, 0.23, 0.125, 0.015],
      [1.44, 0.26, 0.146, 0.012],
      [1.58, 0.235, 0.138, 0],
    ]);
    profile(rig, navy, [
      [1.48, 0.265, 0.15, 0],
      [1.64, 0.238, 0.145, 0],
      [1.9, 0.295, 0.164, 0.002],
      [2.12, 0.351, 0.151, 0.004],
      [2.22, 0.285, 0.124, 0.008],
    ]);
    profile(rig, skin, [
      [2.18, 0.078, 0.072, 0],
      [2.34, 0.074, 0.072, 0],
      [2.43, 0.081, 0.075, 0],
    ]);
    panel(
      rig,
      ivory,
      [
        [-0.115, 2.19],
        [0.115, 2.19],
        [0.066, 1.78],
        [-0.067, 1.78],
      ],
      -0.171,
    );
    for (const side of [-1, 1]) {
      panel(
        rig,
        blue,
        [
          [side * 0.11, 2.21],
          [side * 0.27, 2.18],
          [side * 0.2, 1.97],
          [side * 0.105, 2.04],
        ],
        -0.155,
      );
      tube(
        rig,
        gold,
        [
          [side * 0.12, 2.22, -0.17],
          [side * 0.213, 2.07, -0.18],
          [side * 0.17, 1.82, -0.164],
          [side * 0.2, 1.55, -0.154],
        ],
        0.009,
      );
      panel(
        rig,
        navy,
        [
          [side * 0.12, 1.59],
          [side * 0.27, 1.59],
          [side * 0.29, 1.32],
          [side * 0.17, 1.36],
        ],
        -0.135,
      );
    }
    // A slim cross-body strap and structured hip pouch remain readable from behind.
    tube(
      rig,
      leather,
      [
        [-0.23, 2.2, -0.085],
        [-0.13, 2.0, -0.192],
        [0.025, 1.78, -0.18],
        [0.18, 1.54, -0.157],
      ],
      0.027,
    );
    tube(
      rig,
      leather,
      [
        [-0.23, 2.2, 0.09],
        [-0.07, 1.99, 0.181],
        [0.18, 1.54, 0.164],
      ],
      0.028,
    );
    profile(rig, leather, [
      [1.465, 0.274, 0.158, 0],
      [1.527, 0.266, 0.157, 0],
    ]);
    panel(
      rig,
      gold,
      [
        [-0.049, 1.54],
        [0.047, 1.54],
        [0.047, 1.462],
        [-0.049, 1.462],
      ],
      -0.169,
    );
    panel(
      rig,
      navy,
      [
        [-0.026, 1.522],
        [0.026, 1.522],
        [0.026, 1.479],
        [-0.026, 1.479],
      ],
      -0.182,
    );
    const pouch = pivot(rig, [-0.29, 1.43, 0.02]);
    pouch.rotation.z = 0.09;
    profile(pouch, leather, [
      [-0.17, 0.083, 0.068, 0],
      [-0.11, 0.1, 0.073, 0],
      [0.1, 0.098, 0.071, 0],
      [0.14, 0.074, 0.053, 0],
    ]);
    panel(
      pouch,
      gold,
      [
        [-0.026, 0.079],
        [0.026, 0.079],
        [0.021, 0.02],
        [-0.021, 0.02],
      ],
      -0.079,
      0.006,
    );
    const head = pivot(rig, [0, 2.585, -0.014]);
    profile(
      head,
      skinLight,
      [
        [-0.212, 0.047, 0.053, -0.026],
        [-0.166, 0.111, 0.088, -0.02],
        [-0.067, 0.165, 0.123, -0.009],
        [0.026, 0.185, 0.139, 0],
        [0.109, 0.18, 0.132, 0.012],
        [0.173, 0.144, 0.11, 0.018],
        [0.204, 0.072, 0.052, 0.02],
      ],
      28,
    );
    const eyeWhite = material('#e1e5df', { side: THREE.DoubleSide, roughness: 0.28 });
    const eyeIris = material('#4f929c', { roughness: 0.19 });
    const ink = material('#263244', { roughness: 0.45 });
    const shine = material('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.28 });
    const eyes: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const eye = pivot(head, [side * 0.081, 0.029, -0.131]);
      eye.rotation.y = side * -0.19;
      const outline = new THREE.Shape();
      outline.moveTo(-0.055, -0.002);
      outline.quadraticCurveTo(-0.003, 0.034, 0.055, 0.001);
      outline.quadraticCurveTo(0, -0.027, -0.055, -0.002);
      mesh(eye, new THREE.ShapeGeometry(outline, 12), eyeWhite);
      soft(eye, eyeIris, [0, 0, -0.006], [0.019, 0.022, 0.01], true);
      soft(eye, ink, [0, 0, -0.013], [0.009, 0.016, 0.008], true);
      soft(eye, shine, [-0.006, 0.011, -0.02], [0.005, 0.006, 0.004], true);
      tube(
        eye,
        ink,
        [
          [-0.057, 0.001, -0.006],
          [-0.011, 0.022, -0.005],
          [0.052, 0.005, -0.006],
        ],
        0.0045,
      );
      eyes.push(eye);
      tapered(
        head,
        dark,
        [
          [side * 0.032, 0.077, -0.143],
          [side * 0.079, 0.084, -0.142],
          [side * 0.14, 0.078, -0.109],
        ],
        [0.008, 0.01, 0.003],
        0.6,
      );
      soft(head, skin, [side * 0.185, -0.016, 0.015], [0.031, 0.06, 0.036], true);
      tapered(
        head,
        dark,
        [
          [side * 0.179, 0.117, 0.004],
          [side * 0.189, 0.04, 0.018],
          [side * 0.17, -0.047, -0.008],
        ],
        [0.033, 0.021, 0.003],
        0.45,
      );
    }
    const noseGeometry = new THREE.BufferGeometry();
    noseGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0.064, -0.137, -0.022, -0.047, -0.136, 0.022, -0.047, -0.136, 0, -0.045, -0.19, -0.018,
          -0.068, -0.155, 0.018, -0.068, -0.155, 0, -0.076, -0.161,
        ],
        3,
      ),
    );
    noseGeometry.setIndex([0, 3, 1, 0, 2, 3, 1, 3, 4, 3, 2, 5, 4, 3, 6, 3, 5, 6]);
    noseGeometry.computeVertexNormals();
    mesh(head, noseGeometry, skin);
    tube(
      head,
      material('#ab7d68'),
      [
        [-0.042, -0.112, -0.133],
        [0, -0.116, -0.146],
        [0.041, -0.109, -0.132],
      ],
      0.0035,
    );
    // Swept silver locks have a dark undercut and a deliberate asymmetric fringe.
    soft(head, dark, [0, 0.122, 0.044], [0.19, 0.139, 0.15]);
    for (let i = 0; i < 8; i += 1) {
      const x = -0.145 + i * 0.04;
      const tipY = i < 4 ? 0.1 - i * 0.027 : 0.055 + (i - 4) * 0.023;
      tapered(
        head,
        i === 2 || i === 6 ? hairShade : silverHair,
        [
          [x - 0.039, 0.232 - Math.abs(x) * 0.15, 0.047],
          [x + 0.005, 0.19, -0.065],
          [x + 0.04, tipY + 0.025, -0.147],
          [x + 0.03, tipY - 0.031, -0.145],
        ],
        [0.046, 0.046, 0.03, 0.0025],
        0.36,
      );
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        tapered(
          head,
          i === 0 ? hairLight : silverHair,
          [
            [side * (0.034 + i * 0.045), 0.218, 0.06],
            [side * (0.11 + i * 0.029), 0.12, 0.13],
            [side * (0.088 + i * 0.038), -0.045 - i * 0.02, 0.133],
          ],
          [0.046, 0.043, 0.003],
          0.36,
        );
      }
    }
    tapered(
      head,
      hairLight,
      [
        [-0.1, 0.206, 0.087],
        [-0.032, 0.25, 0.024],
        [0.077, 0.216, -0.03],
      ],
      [0.023, 0.033, 0.003],
      0.4,
    );
    const earring = mesh(
      head,
      new THREE.TorusGeometry(0.019, 0.004, 6, 16),
      gold,
      [-0.191, -0.066, 0.012],
    );
    earring.rotation.y = Math.PI / 2;
    // Layered high collar and two long scarf ribbons frame the head from the back.
    profile(rig, ivory, [
      [2.232, 0.132, 0.101, -0.008],
      [2.288, 0.146, 0.111, -0.014],
      [2.35, 0.105, 0.083, -0.005],
    ]);
    panel(
      rig,
      gold,
      [
        [-0.153, 2.254],
        [-0.089, 2.274],
        [-0.07, 2.216],
        [-0.123, 2.199],
      ],
      -0.111,
    );
    mesh(
      rig,
      new THREE.OctahedronGeometry(0.035),
      teal,
      [-0.115, 2.238, -0.135],
      [0.76, 1.0, 0.35],
    );
    const scarf = pivot(rig, [-0.09, 2.29, 0.09]);
    function ribbon(offset: number, length: number, width: number) {
      const geometry = new THREE.PlaneGeometry(1, 1, 18, 2);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 1) {
        const t = positions.getX(i) + 0.5;
        const w = positions.getY(i) * width * (1 - t * 0.36);
        positions.setXYZ(
          i,
          -t * length + offset,
          -t * 0.26 + Math.sin(t * Math.PI) * 0.085 + w,
          t * 0.39 + Math.sin(t * Math.PI * 1.3) * 0.043,
        );
      }
      geometry.computeVertexNormals();
      mesh(scarf, geometry, ivory);
    }
    ribbon(0, 0.59, 0.12);
    ribbon(0.06, 0.47, 0.075);
    const legPivots: THREE.Group[] = [];
    const knees: THREE.Group[] = [];
    const armPivots: THREE.Group[] = [];
    const elbows: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = pivot(rig, [side * 0.145, 1.46, 0.01]);
      profile(leg, dark, [
        [-0.695, 0.087, 0.086, 0],
        [-0.55, 0.098, 0.102, 0.008],
        [-0.26, 0.124, 0.13, 0.012],
        [0.045, 0.124, 0.132, 0],
      ]);
      tube(
        leg,
        blue,
        [
          [side * 0.122, -0.07, 0.014],
          [side * 0.122, -0.28, 0.01],
          [side * 0.091, -0.59, 0],
        ],
        0.01,
      );
      const knee = pivot(leg, [0, -0.69, 0]);
      profile(knee, dark, [
        [-0.5, 0.065, 0.081, 0.018],
        [-0.3, 0.086, 0.091, 0.029],
        [-0.1, 0.094, 0.094, 0.02],
        [0.038, 0.091, 0.087, 0],
      ]);
      profile(knee, leather, [
        [-0.705, 0.092, 0.14, -0.013],
        [-0.51, 0.082, 0.105, 0.012],
        [-0.27, 0.097, 0.108, 0.018],
        [-0.225, 0.103, 0.111, 0.018],
      ]);
      profile(knee, navy, [
        [-0.739, 0.108, 0.211, -0.072],
        [-0.66, 0.108, 0.205, -0.072],
        [-0.576, 0.087, 0.126, -0.015],
      ]);
      profile(knee, dark, [
        [-0.77, 0.112, 0.22, -0.07],
        [-0.732, 0.113, 0.22, -0.07],
      ]);
      panel(
        knee,
        steel,
        [
          [-0.075, 0.035],
          [0.076, 0.035],
          [0.082, -0.092],
          [0, -0.15],
          [-0.08, -0.09],
        ],
        -0.104,
      );
      tube(
        knee,
        gold,
        [
          [-0.077, -0.248, -0.054],
          [0, -0.247, -0.096],
          [0.077, -0.248, -0.054],
        ],
        0.009,
      );
      tube(
        knee,
        gold,
        [
          [-0.079, -0.54, -0.1],
          [0, -0.57, -0.15],
          [0.079, -0.54, -0.1],
        ],
        0.007,
      );
      legPivots.push(leg);
      knees.push(knee);
      const arm = pivot(rig, [side * 0.342, 2.16, 0.006]);
      profile(arm, navy, [
        [-0.385, 0.081, 0.086, 0],
        [-0.26, 0.1, 0.105, 0.006],
        [-0.09, 0.127, 0.126, 0.005],
        [0.053, 0.113, 0.101, 0],
      ]);
      const shoulder = panel(
        arm,
        gold,
        [
          [-0.112, 0.05],
          [0.098, 0.08],
          [0.143, -0.095],
          [0.091, -0.18],
          [-0.108, -0.145],
        ],
        -0.107,
        0.022,
      );
      const inset = panel(
        arm,
        blue,
        [
          [-0.093, 0.032],
          [0.085, 0.053],
          [0.117, -0.091],
          [0.075, -0.147],
          [-0.09, -0.122],
        ],
        -0.124,
        0.013,
      );
      shoulder.rotation.z = side * -0.14;
      inset.rotation.z = side * -0.14;
      const elbow = pivot(arm, [0, -0.36, 0]);
      profile(elbow, ivory, [
        [-0.13, 0.065, 0.069, 0],
        [0.029, 0.079, 0.08, 0],
      ]);
      profile(elbow, navy, [
        [-0.31, 0.066, 0.068, 0],
        [-0.16, 0.083, 0.078, 0],
        [-0.095, 0.077, 0.075, 0],
      ]);
      panel(
        elbow,
        steel,
        [
          [-0.055, -0.13],
          [0.055, -0.13],
          [0.064, -0.27],
          [0, -0.31],
          [-0.064, -0.27],
        ],
        -0.075,
      );
      tube(
        elbow,
        gold,
        [
          [-0.056, -0.286, -0.046],
          [0, -0.3, -0.079],
          [0.056, -0.286, -0.046],
        ],
        0.007,
      );
      profile(elbow, leather, [
        [-0.389, 0.057, 0.037, -0.008],
        [-0.34, 0.066, 0.042, -0.006],
        [-0.303, 0.055, 0.041, 0],
      ]);
      soft(elbow, skinLight, [0, -0.402, -0.007], [0.055, 0.043, 0.037], true);
      soft(elbow, skin, [-side * 0.052, -0.362, -0.032], [0.02, 0.044, 0.023], true);
      armPivots.push(arm);
      elbows.push(elbow);
    }
    // Flowing split half-cloak: a long left panel, shorter right panel, ivory piping.
    const capes: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const height = side < 0 ? 1.15 : 0.95;
      const cape = pivot(rig, [0, 2.19, 0.19]);
      const geometry = new THREE.PlaneGeometry(1, 1, 12, 18);
      const positions = geometry.getAttribute('position');
      const surface = (u: number, v: number): Point => [
        side * (THREE.MathUtils.lerp(0.005, 0.13, v * v) + u * (0.34 + v * 0.1)),
        -height * v + Math.sin(u * Math.PI) * 0.045 * v,
        0.045 + Math.sin(v * Math.PI) * 0.11 + v * 0.16 + Math.cos(u * Math.PI * 3) * v * 0.014,
      ];
      for (let i = 0; i < positions.count; i += 1)
        positions.setXYZ(i, ...surface(positions.getX(i) + 0.5, 0.5 - positions.getY(i)));
      geometry.computeVertexNormals();
      mesh(cape, geometry, cloakMaterial);
      const edge: Point[] = [];
      const piping: Point[] = [];
      for (let i = 0; i <= 20; i += 1) {
        edge.push(surface(1, i / 20));
        piping.push(surface(0.87, i / 20));
      }
      tube(cape, gold, edge, 0.01);
      tube(cape, ivory, piping, 0.018);
      const hem: Point[] = [];
      for (let i = 0; i <= 12; i += 1) hem.push(surface(i / 12, 1));
      tube(cape, gold, hem, 0.009);
      capes.push(cape);
    }
    const backBadge = mesh(
      rig,
      new THREE.TorusGeometry(0.075, 0.009, 6, 4),
      gold,
      [0, 1.989, 0.285],
      [0.76, 1.1, 1],
    );
    backBadge.rotation.z = Math.PI / 4;
    tube(
      rig,
      gold,
      [
        [-0.15, 2.14, 0.222],
        [0, 1.9, 0.306],
        [0.15, 2.14, 0.222],
      ],
      0.008,
    );
    // A slim ceremonial scabbard is decorative; no weapon/attack behaviour is added.
    const scabbard = pivot(rig, [0.275, 1.55, 0.245]);
    scabbard.rotation.z = 0.22;
    tapered(
      scabbard,
      navy,
      [
        [0, -0.025, 0],
        [0.025, -0.4, 0.006],
        [0.032, -0.88, 0.025],
      ],
      [0.048, 0.043, 0.017],
      0.55,
    );
    tube(
      scabbard,
      gold,
      [
        [-0.03, -0.045, -0.03],
        [-0.01, -0.43, -0.024],
        [0.027, -0.84, 0],
      ],
      0.007,
    );
    profile(scabbard, gold, [
      [-0.037, 0.059, 0.034, 0],
      [0.018, 0.059, 0.034, 0],
    ]);
    tapered(
      scabbard,
      leather,
      [
        [0, 0.02, 0],
        [0, 0.19, 0],
        [0, 0.255, 0],
      ],
      [0.028, 0.028, 0.023],
      0.82,
    );
    tube(
      scabbard,
      gold,
      [
        [-0.09, 0.032, 0],
        [0, 0.055, 0],
        [0.09, 0.032, 0],
      ],
      0.014,
    );
    soft(scabbard, teal, [0, 0.26, 0], [0.025, 0.039, 0.022], true);
    let riding = false;
    const hipPoint = new THREE.Vector3(0, 1.46, 0.01);
    const riderHip = hipPoint.clone();
    return {
      group,
      riderHip,
      setRiding(value) {
        riding = value;
      },
      animate(time, speed, jump = 0) {
        const move = THREE.MathUtils.clamp(speed, 0, 1);
        const gait = time * (7 + move * 3.5);
        rig.position.y = riding
          ? Math.sin(time * 3.5) * 0.006
          : Math.abs(Math.sin(gait)) * move * 0.047 + Math.sin(time * 1.9) * 0.005;
        rig.rotation.x = riding ? -0.025 : -move * 0.055 + jump * 0.035;
        rig.rotation.z = riding ? 0 : Math.sin(gait) * move * 0.01;
        legPivots.forEach((leg, index) => {
          const side = index === 0 ? -1 : 1;
          leg.position.x = side * (riding ? 0.22 : 0.145);
          leg.rotation.x = riding
            ? 1.1
            : Math.sin(gait + index * Math.PI) * move * 0.56 - jump * 0.16;
          leg.rotation.z = riding ? side * 0.22 : 0;
          knees[index].rotation.x = riding
            ? -1.04
            : -Math.max(0, -Math.sin(gait + index * Math.PI)) * move * 0.26;
        });
        armPivots.forEach((arm, index) => {
          const side = index === 0 ? -1 : 1;
          arm.rotation.x = riding
            ? 0.92 + Math.sin(time * 3.5) * 0.012
            : -Math.sin(gait + index * Math.PI) * move * 0.53 - jump * 0.24;
          arm.rotation.z = side * (riding ? -0.17 : 0.06);
          elbows[index].rotation.x = riding ? 0.2 : 0.08 + move * 0.22;
        });
        capes.forEach((cape, index) => {
          cape.rotation.x =
            -0.018 -
            (riding
              ? 0.3 + Math.sin(time * 5 + index) * 0.04
              : move * (0.15 + Math.sin(gait + index) * 0.045));
          cape.rotation.z = Math.sin(time * 1.8 + index) * (0.012 + move * 0.023);
        });
        scarf.rotation.x = Math.sin(time * 3.1) * 0.085 + (riding ? 0.2 : move * 0.11);
        scarf.rotation.z = Math.sin(time * 2.4) * 0.06;
        scabbard.rotation.x = riding ? -0.27 : Math.sin(gait) * move * 0.022;
        head.rotation.y = Math.sin(time * 0.62) * 0.055 * (1 - move);
        const blink = (time + 0.2) % 5.7;
        eyes.forEach((eye) => {
          eye.scale.y = blink < 0.12 ? Math.max(0.06, Math.abs(blink - 0.06) / 0.06) : 1;
        });
        rig.updateMatrix();
        riderHip.copy(hipPoint).applyMatrix4(rig.matrix);
      },
      dispose: k.dispose,
    };
  } catch (error) {
    k.dispose();
    throw error;
  }
}
