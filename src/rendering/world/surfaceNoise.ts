/** Small deterministic surface noise shared by outdoor materials; no texture downloads. */
export const SURFACE_NOISE = /* glsl */ `
float fieldHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fieldNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fieldHash(cell), fieldHash(cell + vec2(1, 0)), u.x),
    mix(fieldHash(cell + vec2(0, 1)), fieldHash(cell + vec2(1, 1)), u.x), u.y);
}
float fieldLayers(vec2 p) {
  return fieldNoise(p) * 0.57 + fieldNoise(p * 2.03 + 7.1) * 0.29
    + fieldNoise(p * 4.07 + 19.2) * 0.14;
}
`;
