// The Musi: an opaque, silty river with a planar mirror reflection.
// Mirror maths follow three.js' Reflector (oblique clip plane, mirrored
// view offset); rendering is driven explicitly by the world loop so the
// reflection can run at a reduced resolution or be skipped entirely.
import {
  Color,
  DataTexture,
  HalfFloatType,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { SkyState } from './time';

const vert = /* glsl */ `
uniform mat4 uTexMatrix;
varying vec3 vWorld;
varying vec4 vMirror;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vMirror = uTexMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
uniform sampler2D tReflect;
uniform sampler2D tNormal;
uniform float uReflect;
uniform float uTime;
uniform float uDistort;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunI;
uniform float uEnvI;
uniform vec3 uBody;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uCalm;
varying vec3 vWorld;
varying vec4 vMirror;

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  vec3 n1 = texture2D(tNormal, p * 0.043 + vec2(0.010, 0.017) * t).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(tNormal, p * 0.0115 + vec2(-0.0035, 0.0065) * t).xyz * 2.0 - 1.0;
  vec3 n3 = texture2D(tNormal, p * 0.17 + vec2(0.021, -0.029) * t).xyz * 2.0 - 1.0;
  vec2 slope = (n1.xy * 0.55 + n2.xy * 0.3 + n3.xy * 0.3) * 0.32;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  slope *= mix(1.0, 0.25, smoothstep(40.0, 700.0, dist)) * uCalm;
  vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
  vec3 V = toCam / dist;
  float nv = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);

  vec3 R = reflect(-V, N);
  vec3 skyR = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
  vec2 ruv = vMirror.xy / vMirror.w + slope * uDistort / (1.0 + dist * 0.012);
  vec3 mirror = texture2D(tReflect, ruv).rgb;
  vec3 refl = mix(skyR, mirror, uReflect);

  vec3 body = uBody * (0.42 * uEnvI + 0.22 * uSunI * max(uSunDir.y, 0.0));
  // silt keeps a little of the sky colour even looking straight down
  body += skyR * 0.06;
  vec3 col = mix(body, refl, clamp(F * 1.08, 0.0, 1.0));

  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float sunUp = smoothstep(-0.03, 0.04, uSunDir.y);
  col += uSunColor * uSunI * (pow(nh, 900.0) * 5.0 + pow(nh, 120.0) * 0.1) * sunUp;

  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Water {
  mesh: Mesh;
  mat: ShaderMaterial;
  private rt: WebGLRenderTarget | null = null;
  private scale = 0.5;
  private cam = new PerspectiveCamera();
  private texMatrix = new Matrix4();
  private plane = new Plane();
  private clip = new Vector4();
  private q = new Vector4();
  private v = new Vector3();
  private n = new Vector3(0, 1, 0);
  private w = new Vector3();
  private c = new Vector3();
  private look = new Vector3();
  private rot = new Matrix4();
  private black: DataTexture;

  constructor(normal: Texture) {
    normal.wrapS = normal.wrapT = RepeatWrapping;
    this.black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        tReflect: { value: this.black },
        tNormal: { value: normal },
        uTexMatrix: { value: this.texMatrix },
        uReflect: { value: 0 },
        uTime: { value: 0 },
        uDistort: { value: 0.045 },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color() },
        uSunI: { value: 1 },
        uEnvI: { value: 1 },
        uBody: { value: new Color('#4a4130') },
        uHorizon: { value: new Color() },
        uZenith: { value: new Color() },
        uFogColor: { value: new Color() },
        uFogDensity: { value: 0.001 },
        uCalm: { value: 1 },
      },
    });
    const geo = new PlaneGeometry(720, 5200, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.position.set(15, 0, -1900);
    this.mesh.name = 'musi';
    this.mesh.receiveShadow = false;
    this.mesh.updateMatrixWorld();
    // layer 0 only: never drawn into its own reflection
  }

  /** scale = 0 turns the mirror off and falls back to a sky reflection. */
  setReflection(scale: number, width: number, height: number) {
    this.scale = scale;
    if (scale <= 0) {
      this.rt?.dispose();
      this.rt = null;
      this.mat.uniforms.tReflect.value = this.black;
      this.mat.uniforms.uReflect.value = 0;
      return;
    }
    const w = Math.max(64, Math.round(width * scale));
    const h = Math.max(64, Math.round(height * scale));
    if (!this.rt) {
      this.rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 0 });
      this.rt.texture.name = 'pantulan';
    } else this.rt.setSize(w, h);
    this.mat.uniforms.tReflect.value = this.rt.texture;
    this.mat.uniforms.uReflect.value = 1;
  }

  resize(width: number, height: number) {
    if (this.rt) this.setReflection(this.scale, width, height);
  }

  apply(s: SkyState, fogColor: Color, fogDensity: number, time: number) {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uSunDir.value.copy(s.sunDir);
    u.uSunColor.value.copy(s.cols.sun);
    u.uSunI.value = s.nums.sunI;
    u.uEnvI.value = s.nums.env;
    u.uBody.value.copy(s.cols.water);
    u.uHorizon.value.copy(s.cols.horizon);
    u.uZenith.value.copy(s.cols.zenith);
    u.uFogColor.value.copy(fogColor);
    u.uFogDensity.value = fogDensity;
  }

  /** Render the mirrored scene. Call before the main render each frame. */
  renderReflection(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    if (!this.rt) return;
    const { cam, n, w, c, v, look, rot, plane, clip, q, texMatrix } = this;
    w.setFromMatrixPosition(this.mesh.matrixWorld);
    c.setFromMatrixPosition(camera.matrixWorld);
    if (c.y < 0.05) return;

    v.subVectors(w, c).reflect(n).negate().add(w);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(c);
    // mirror of the look-at point across the water plane
    const target = look.sub(w).reflect(n).add(w);

    cam.position.copy(v);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    cam.lookAt(target);
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrix.elements[8] *= -1;
    cam.projectionMatrix.elements[12] *= -1;

    texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texMatrix.multiply(cam.projectionMatrix);
    texMatrix.multiply(cam.matrixWorldInverse);
    texMatrix.multiply(this.mesh.matrixWorld);

    plane.setFromNormalAndCoplanarPoint(n, w);
    plane.applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1;
    q.w = (1 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1 - 0.003;
    pm.elements[14] = clip.w;
    cam.projectionMatrixInverse.copy(pm).invert();

    this.mesh.visible = false;
    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    this.mesh.visible = true;
  }

  dispose() {
    this.rt?.dispose();
    this.mat.dispose();
    this.mesh.geometry.dispose();
    this.black.dispose();
  }
}
