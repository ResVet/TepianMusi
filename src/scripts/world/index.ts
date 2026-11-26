// The river world: renderer, post-processing, light and weather, loading
// order, and the frame loop that ties scroll position to the scene.
import {
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HalfFloatType,
  HemisphereLight,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  Object3D,
  PCFShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  HueSaturationEffect,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { BASE } from '../base';
import { Assets } from './assets';
import { Boat, Egrets, Traffic, recenter } from './boats';
import { createTown, type Town } from './city';
import { HOURS, Journey, chasePose, copyPose, endPose, heroPose, lerpPose, makePose, stationPose, type JourneyState, type Pose } from './journey';
import { AMPERA_X, AMPERA_Z, SITES, leftEdge } from './layout';
import { instance, planProps, type PropName } from './props';
import { Governor, SETTINGS, guessTier, nextTier, type Tier, type TierSettings } from './quality';
import { SkyDome } from './sky';
import { attach, createStations, updateGlows, type StationSet } from './stations';
import { createTerrain, heightAt } from './terrain';
import { clockText, createSkyState, dayPart, sampleSky, type SkyState } from './time';
import { Water } from './water';

export interface WorldHooks {
  progress(p: number): void;
  ready(): void;
  stationReady(i: number): void;
  frame(f: FrameInfo): void;
  lost(): void;
}

export interface FrameInfo {
  state: JourneyState;
  clock: string;
  part: string;
  night: number;
  boatX: number;
  boatZ: number;
}

const CRITICAL = ['ketek', 'dermaga_kayu', 'chengho', 'kelapa_a', 'kelapa_b', 'nipah', 'rumah_a', 'rumah_b', 'rumah_c', 'rumah_d', 'semak', 'pohon'];
const LATER = ['rakit_a', 'rakit_b', 'jukung_hijau', 'jukung_biru', 'kuntul', 'dermaga2', 'munawar', 'kapitan', 'pempek', 'dermaga4', 'ampera'];
const STATION_MODELS: Record<number, string[]> = {
  0: ['chengho', 'dermaga_kayu'],
  1: ['dermaga2', 'dermaga_kayu'],
  2: ['munawar', 'kapitan', 'pempek', 'dermaga_kayu'],
  3: ['dermaga4', 'dermaga_kayu'],
  4: ['ampera', 'dermaga_kayu'],
};

export class World {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.5, 6500);
  readonly assets: Assets;
  readonly journey = new Journey();
  readonly stations: StationSet;
  boat: Boat | null = null;
  tier: Tier;
  settings: TierSettings;
  sky: SkyState = createSkyState();
  state: JourneyState = { s: 0, hero: 1, dock: 0, dockIdx: 0, leg: 0, end: 0, hour: HOURS[0], active: 'berangkat', stop: -1, progress: 0 };
  /** Interaction camera; blended over the journey camera by overrideK. */
  override: Pose = makePose();
  overrideK = 0;
  frozen = false; // journey state held still while an interaction is open
  focus = new Vector3();
  shadowSize = 70;
  time = 0;
  narrow = false;
  width = 1;
  height = 1;
  panelSides = [1, -1, 1, -1, 1];
  onTick: ((dt: number, t: number) => void) | null = null;

  private composer!: EffectComposer;
  private aoPass: N8AOPostPass | null = null;
  private smaaPass: EffectPass | null = null;
  private bloom!: BloomEffect;
  private vignette!: VignetteEffect;
  private skyDome: SkyDome;
  private envDome: SkyDome;
  private envScene = new Scene();
  private envRT: WebGLRenderTarget | null = null;
  private envHour = -99;
  private envTimer = 0;
  private pmrem: PMREMGenerator;
  private water: Water | null = null;
  private sun = new DirectionalLight('#ffffff', 2);
  /** One warm point light kept in the scene for close-ups (pelita, lamps). */
  readonly accent = new PointLight('#ffb064', 0, 4, 2);
  private hemi = new HemisphereLight('#ffffff', '#444444', 0.4);
  private fog = new FogExp2('#cccccc', 0.001);
  private town: Town | null = null;
  private traffic: Traffic | null = null;
  private egrets: Egrets | null = null;
  private props = new Group();
  private gov: Governor;
  private hour = HOURS[0];
  private raf = 0;
  private last = 0;
  private running = false;
  private camPose = makePose();
  private want = makePose();
  private pa = makePose();
  private pb = makePose();
  private boatPos = new Vector3();
  private boatDir = new Vector3(0, 0, -1);
  private lookAt = new Vector3();
  private bridgeLook = new Vector3();
  private firstFrame = true;
  private maps: Record<string, Texture> = {};
  private readyStations = new Set<number>();
  private loadedModels = new Set<string>();
  private interiorNight = { value: 0 };

  constructor(private host: HTMLElement, private hooks: WorldHooks, private reduced: boolean) {
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    const gl = this.renderer.getContext();
    const forced = new URLSearchParams(location.search).get('q');
    this.tier = forced === 'high' || forced === 'mid' || forced === 'low' ? forced : guessTier(gl);
    this.settings = SETTINGS[this.tier];
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setClearColor('#0a1512', 1);
    host.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onRestored, false);

    this.assets = new Assets(this.renderer);
    this.pmrem = new PMREMGenerator(this.renderer);
    this.camera.layers.enable(1);
    this.scene.fog = this.fog;

    this.skyDome = new SkyDome(4800, false);
    this.scene.add(this.skyDome.mesh);
    this.envDome = new SkyDome(60, true);
    this.envScene.add(this.envDome.mesh);

    this.sun.castShadow = this.settings.shadows > 0;
    this.sun.shadow.camera.layers.enableAll();
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    this.accent.castShadow = false;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.accent);

    this.stations = createStations();
    this.scene.add(this.stations.root, this.props);
    this.gov = new Governor(() => this.dropTier());
    this.setupPost();
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // ------------------------------------------------------------ setup ----
  private setupPost() {
    const r = this.renderer;
    this.composer = new EffectComposer(r, { frameBufferType: HalfFloatType, multisampling: 0 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.settings.ao) {
      try {
        const ao = new N8AOPostPass(this.scene, this.camera, 1, 1);
        ao.configuration.aoRadius = 2.2;
        ao.configuration.distanceFalloff = 0.8;
        ao.configuration.intensity = 2.6;
        ao.configuration.halfRes = true;
        ao.configuration.transparencyAware = false;
        ao.configuration.gammaCorrection = false;
        ao.setQualityMode('Medium');
        this.aoPass = ao;
        this.composer.addPass(ao);
      } catch {
        this.aoPass = null;
      }
    }
    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.05, luminanceSmoothing: 0.3, intensity: 0.8, radius: 0.74, levels: this.settings.bloomLevels });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.vignette = new VignetteEffect({ offset: 0.3, darkness: 0.52 });
    // AgX is gentle; give the grade back a little bite
    const sat = new HueSaturationEffect({ saturation: 0.16 });
    const con = new BrightnessContrastEffect({ contrast: 0.1 });
    this.composer.addPass(new EffectPass(this.camera, this.bloom, tone, sat, con, this.vignette));
    if (this.settings.smaa) {
      this.smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM }));
      this.composer.addPass(this.smaaPass);
    }
  }

  private applyTier() {
    const s = this.settings;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.dpr));
    const castNow = s.shadows > 0;
    this.renderer.shadowMap.enabled = castNow;
    this.sun.castShadow = castNow;
    if (castNow && this.sun.shadow.mapSize.x !== s.shadows) {
      this.sun.shadow.mapSize.set(s.shadows, s.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (this.aoPass) this.aoPass.enabled = s.ao;
    if (this.smaaPass) this.smaaPass.enabled = s.smaa;
    this.resize();
  }

  private dropTier() {
    const n = nextTier(this.tier);
    if (!n) return;
    this.tier = n;
    // keep prop density from the first tier; only rendering costs drop
    this.settings = { ...SETTINGS[n], density: this.settings.density };
    this.applyTier();
    this.gov.reset(4);
  }

  resize = () => {
    const w = Math.max(1, this.host.clientWidth || window.innerWidth);
    const h = Math.max(1, this.host.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.narrow = w < 1024;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.dpr));
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.water?.setReflection(this.settings.reflection, w * pr, h * pr);
    this.journey.measure();
  };

  // ---------------------------------------------------------- loading ----
  async start() {
    const tl = new TextureLoader();
    const tex = (n: string) =>
      new Promise<Texture>((res, rej) => tl.load(`${BASE}textures/${n}.webp`, res, undefined, rej));
    const [grass, grassN, grassR, mud, mudN, mudR, airN, foam] = await Promise.all(
      ['rumput_c', 'rumput_n', 'rumput_r', 'lumpur_c', 'lumpur_n', 'lumpur_r', 'air_n', 'busa_c'].map(tex),
    );
    this.maps = { foam, airN };
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    for (const m of createTerrain({ grass, grassN, grassR, mud, mudN, mudR }, aniso)) this.scene.add(m);
    this.water = new Water(airN);
    this.scene.add(this.water.mesh);
    this.town = createTown(this.settings.density);
    this.scene.add(this.town.root);
    this.applyTier();
    this.updateSky(0, true);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    // critical models first, with a byte-accurate progress bar
    const tick = setInterval(() => {
      const b = this.assets.bytes(CRITICAL);
      this.hooks.progress(b.total ? b.loaded / b.total : 0);
    }, 120);
    try {
      await Promise.all(CRITICAL.map((n) => this.assets.load(n).then((g) => this.onModel(n, g))));
    } finally {
      clearInterval(tick);
    }
    this.hooks.progress(1);
    this.buildProps();
    await this.compile();
    this.hooks.ready();
    // everything else in station order, one at a time to keep the frame rate
    for (const n of LATER) {
      try {
        const g = await this.assets.load(n);
        this.onModel(n, g);
        if (n === 'rakit_a' || n === 'jukung_biru') this.buildProps();
        if (n === 'jukung_biru') this.buildTraffic();
        if (n === 'kuntul') this.buildBirds(g);
        await new Promise((r) => setTimeout(r, 30));
      } catch (e) {
        console.warn('model gagal dimuat', n, e);
      }
    }
  }

  private onModel(name: string, g: Group) {
    this.loadedModels.add(name);
    if (name === 'ketek') {
      this.boat = new Boat(g, this.maps.foam, 10.6, 1.0);
      this.scene.add(this.boat.root, this.boat.wake.mesh);
    }
    if (['chengho', 'dermaga2', 'munawar', 'kapitan', 'pempek', 'dermaga4', 'ampera', 'dermaga_kayu'].includes(name)) {
      attach(this.stations, name, g, this.assets, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    }
    if (name === 'semak') {
      const leaf = this.assets.materials.get('daun_rimbun');
      if (leaf) this.town?.setLeaves(leaf);
    }
    if (name === 'jukung_hijau' || name === 'jukung_biru') {
      for (const m of g.children) if (m.userData.tm === 'prop' && (m as Mesh).isMesh) recenter(m as Mesh);
    }
    for (const [i, needs] of Object.entries(STATION_MODELS)) {
      const k = Number(i);
      if (!this.readyStations.has(k) && needs.every((n) => this.loadedModels.has(n))) {
        this.readyStations.add(k);
        this.hooks.stationReady(k);
      }
    }
  }

  isStationReady(i: number) {
    return this.readyStations.has(i);
  }

  private builtProps = new Set<string>();
  private buildProps() {
    const plan = planProps(this.settings.density);
    for (const [name, list] of plan) {
      if (this.builtProps.has(name)) continue;
      const model = this.assets.get(name);
      if (!model) continue;
      this.builtProps.add(name);
      model.updateMatrixWorld(true);
      const parts: { mesh: Mesh; matrix: Matrix4 }[] = [];
      model.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) parts.push({ mesh: m, matrix: m.matrixWorld.clone() });
      });
      instance(name, parts, list, this.props, {
        match: (mat) => mat.name === 'ruang_gelap',
        make: (mat) => this.interiorMaterial(mat),
      });
    }
  }

  private interiorMat: Material | null = null;
  /** Interior darkness that lights up at night, per house (instance colour). */
  private interiorMaterial(base: Material): Material {
    if (this.interiorMat) return this.interiorMat;
    const m = (base as MeshStandardMaterial).clone();
    m.name = 'ruang_gelap_malam';
    m.emissive = new Color('#ffb066');
    m.emissiveIntensity = 1;
    const u = this.interiorNight;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNightK = u;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNightK;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
#ifdef USE_INSTANCING_COLOR
totalEmissiveRadiance *= uNightK * step(0.5, vColor.r) * 2.2;
#else
totalEmissiveRadiance *= uNightK;
#endif`,
        );
    };
    m.customProgramCacheKey = () => 'ruang_gelap_malam';
    this.interiorMat = m;
    return m;
  }

  private buildTraffic() {
    const a = this.assets.get('jukung_hijau');
    const b = this.assets.get('jukung_biru');
    if (!a || !b || this.traffic) return;
    this.traffic = new Traffic([a, b], this.maps.foam, this.tier === 'low' ? 2 : 4);
    this.scene.add(this.traffic.root);
    for (const w of this.traffic.wakes) this.scene.add(w.mesh);
  }

  private buildBirds(model: Group) {
    const perched: [number, number, number][] = [];
    for (const z of [60, -260, -560, -980, -1450, -1820]) {
      const x = leftEdge(z) - 0.8;
      perched.push([x, heightAt(x, z), z]);
    }
    this.egrets = new Egrets(model, perched);
    this.scene.add(this.egrets.root);
  }

  /** Warm up shaders so the first scroll does not stutter. */
  private async compile() {
    try {
      const r = this.renderer as WebGLRenderer & { compileAsync?: (s: Object3D, c: PerspectiveCamera) => Promise<unknown> };
      if (r.compileAsync) await r.compileAsync(this.scene, this.camera);
    } catch {
      /* not fatal */
    }
  }

  // ------------------------------------------------------------- loop ----
  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += this.reduced ? dt * 0.35 : dt;
    this.frame(dt);
    this.gov.tick(dt);
  };

  private frame(dt: number) {
    const t = this.time;
    if (!this.frozen) this.journey.sample(window.scrollY, window.innerHeight, this.state);
    const st = this.state;

    // hour eases toward the scroll hour so the light never jumps
    const k = this.firstFrame || this.reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    this.hour += (st.hour - this.hour) * k;
    this.updateSky(dt);

    // boat
    this.journey.boat(st.s, this.boatPos, this.boatDir);
    if (this.boat) this.boat.place(this.boatPos, this.boatDir, dt, t);

    // camera
    this.cameraTarget(this.want);
    if (this.firstFrame || this.reduced) copyPose(this.want, this.camPose);
    else {
      const a = 1 - Math.exp(-dt * (this.overrideK > 0.01 ? 7 : 4.2));
      lerpPose(this.camPose, this.want, a, this.camPose);
    }
    this.applyCamera(this.camPose);

    this.traffic?.update(dt, t, this.camera.position.z);
    this.egrets?.update(dt, t, this.camera);
    const lamps = this.sky.nums.lamps;
    this.stations.update(dt, t, lamps);
    this.stations.ampera?.updateClock(new Date());
    updateGlows(this.assets, lamps, t);
    this.onTick?.(dt, t);

    this.updateShadow();
    if (this.water && this.settings.reflection > 0) this.water.renderReflection(this.renderer, this.scene, this.camera);
    this.composer.render(dt);
    this.firstFrame = false;

    this.hooks.frame({
      state: st,
      clock: clockText(this.hour),
      part: dayPart(this.hour),
      night: MathUtils.clamp(lamps, 0, 1),
      boatX: this.boatPos.x,
      boatZ: this.boatPos.z,
    });
  }

  private cameraTarget(out: Pose) {
    const st = this.state;
    const n = this.narrow;
    chasePose(st.leg, this.boatPos, this.boatDir, this.pa);
    if (st.leg === 4) {
      // on the last leg keep Ampera in frame as it grows
      const d = Math.hypot(this.boatPos.x - AMPERA_X, this.boatPos.z - AMPERA_Z);
      const k = MathUtils.smoothstep(d, 950, 260);
      this.bridgeLook.set(AMPERA_X - 6, 26, AMPERA_Z);
      this.pa.target.lerp(this.bridgeLook, k * 0.8);
      this.pa.pos.y += k * 2.5;
    }
    if (st.hero > 0) lerpPose(this.pa, heroPose(this.pb, n), st.hero, this.pa);
    if (st.dock > 0) lerpPose(this.pa, stationPose(st.dockIdx, this.pb, n, this.panelSides[st.dockIdx] ?? 1), smooth(st.dock), this.pa);
    if (st.end > 0) lerpPose(this.pa, endPose(this.pb, n), smooth(st.end), this.pa);
    if (this.overrideK > 0) lerpPose(this.pa, this.override, this.overrideK, this.pa);
    copyPose(this.pa, out);
  }

  private applyCamera(p: Pose) {
    const c = this.camera;
    c.position.copy(p.pos);
    // never dip under the water or into the bank
    const ground = Math.max(0, heightAt(c.position.x, c.position.z));
    if (c.position.y < ground + 0.45) c.position.y = ground + 0.45;
    this.lookAt.copy(p.target);
    c.lookAt(this.lookAt);
    c.fov = p.fov;
    const dist = c.position.distanceTo(p.target);
    c.near = MathUtils.clamp(dist * 0.012, 0.03, 0.9);
    c.far = 6500;
    if (Math.abs(p.shiftX) > 0.001 || Math.abs(p.shiftY) > 0.001) {
      c.setViewOffset(this.width, this.height, p.shiftX * this.width, p.shiftY * this.height, this.width, this.height);
    } else if (c.view) c.clearViewOffset();
    c.updateProjectionMatrix();
    this.focus.copy(p.target);
    this.shadowSize = MathUtils.clamp(dist * 0.9, 6, 90);
  }

  private lightBasisX = new Vector3();
  private lightBasisY = new Vector3();
  private shadowCenter = new Vector3();
  private updateShadow() {
    const s = this.sky;
    const sunUp = s.sunDir.y > -0.02;
    const dir = sunUp ? s.sunDir : s.moonDir;
    const size = this.shadowSize;
    const cam = this.sun.shadow.camera;
    if (cam.right !== size) {
      cam.left = -size;
      cam.right = size;
      cam.top = size;
      cam.bottom = -size;
      cam.near = 1;
      cam.far = 900;
      cam.updateProjectionMatrix();
    }
    // snap to shadow texels so edges do not crawl while the camera glides
    const texel = (2 * size) / Math.max(256, this.sun.shadow.mapSize.x);
    const up = Math.abs(dir.y) > 0.99 ? X_AXIS : Y_AXIS;
    this.lightBasisX.crossVectors(up, dir).normalize();
    this.lightBasisY.crossVectors(dir, this.lightBasisX).normalize();
    const f = this.focus;
    const lx = Math.round(f.dot(this.lightBasisX) / texel) * texel;
    const ly = Math.round(f.dot(this.lightBasisY) / texel) * texel;
    const lz = f.dot(dir);
    const center = this.shadowCenter.set(0, 0, 0).addScaledVector(this.lightBasisX, lx).addScaledVector(this.lightBasisY, ly).addScaledVector(dir, lz);
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(dir, 400);
    this.sun.target.updateMatrixWorld();
  }

  private fogColor = new Color();
  private updateSky(dt: number, force = false) {
    const s = sampleSky(this.hour, this.sky);
    const n = s.nums;
    this.skyDome.mesh.position.copy(this.camera.position);
    this.skyDome.apply(s, this.time);
    const sunUp = s.sunDir.y > -0.02;
    if (sunUp) {
      this.sun.color.copy(s.cols.sun);
      this.sun.intensity = n.sunI;
    } else {
      this.sun.color.set('#9fb4e6');
      this.sun.intensity = 0.32 * n.stars + 0.05;
    }
    this.hemi.color.copy(s.cols.hemiSky);
    this.hemi.groundColor.copy(s.cols.hemiGround);
    this.hemi.intensity = n.hemiI;
    this.fogColor.copy(s.cols.horizon).lerp(s.cols.zenith, 0.12);
    this.fog.color.copy(this.fogColor);
    this.fog.density = n.fog * (1 - 0.25 * MathUtils.smoothstep(this.camera.position.y, 20, 80));
    this.renderer.toneMappingExposure = n.exposure;
    this.bloom.intensity = n.bloom;
    this.scene.environmentIntensity = n.env;
    this.water?.apply(s, this.fogColor, this.fog.density, this.time);
    if (this.boat) this.boat.wake.setLook(this.fogColor, this.fog.density, 0.25 + 0.55 * Math.min(1, n.sunI / 2.5 + n.env * 0.3));
    for (const w of this.traffic?.wakes ?? []) w.setLook(this.fogColor, this.fog.density, 0.2 + 0.4 * Math.min(1, n.sunI / 2.5));
    this.town?.setNight(n.lamps, n.lamps);
    this.interiorNight.value = n.lamps;

    // environment light from the sky, refreshed as the hour moves
    this.envTimer -= dt;
    const step = this.tier === 'low' ? 0.45 : 0.22;
    if (force || (!this.frozen && Math.abs(this.hour - this.envHour) > step && this.envTimer <= 0)) {
      this.envDome.copyFrom(this.skyDome);
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
      this.envRT?.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.envHour = this.hour;
      this.envTimer = this.tier === 'high' ? 0.5 : 0.9;
    }
  }

  // ---------------------------------------------------- interactions ----
  setOverride(p: Pose) {
    copyPose(p, this.override);
  }

  /** Where a dermaga's boat waits; used by the map. */
  berth(i: number) {
    return SITES[i].berth;
  }

  /** Render a still for the Kartu Sila from the finale viewpoint. */
  capture(w: number, h: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const g = out.getContext('2d')!;
    const prevW = this.width;
    const prevH = this.height;
    const prevHour = this.hour;
    const pose = makePose();
    pose.pos.set(-150, 26, AMPERA_Z + 160);
    pose.target.set(10, 30, AMPERA_Z);
    pose.fov = 42;
    this.hour = 19.6;
    this.updateSky(0, true);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.width = w;
    this.height = h;
    this.applyCamera(pose);
    this.updateShadow();
    if (this.water && this.settings.reflection > 0) {
      const pr = this.renderer.getPixelRatio();
      this.water.setReflection(this.settings.reflection, w * pr, h * pr);
      this.water.renderReflection(this.renderer, this.scene, this.camera);
    }
    this.composer.render(0);
    g.drawImage(this.renderer.domElement, 0, 0, w, h);
    this.hour = prevHour;
    this.width = prevW;
    this.height = prevH;
    this.resize();
    this.updateSky(0, true);
    return out;
  }

  setLeds(done: boolean[]) {
    this.stations.ampera?.setLedTargets(done);
  }

  // ------------------------------------------------------- lifecycle ----
  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
    } else if (this.running) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private onLost = (e: Event) => {
    e.preventDefault();
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.hooks.lost();
  };

  private onRestored = () => {
    this.running = true;
    this.envHour = -99;
    this.applyTier();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    document.documentElement.classList.remove('is-lost');
  };

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          for (const v of Object.values(mat)) if (v && (v as Texture).isTexture) (v as Texture).dispose();
          mat.dispose();
        }
      }
    });
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.water?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
