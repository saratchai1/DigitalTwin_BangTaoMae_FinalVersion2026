import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowDown, ArrowUp, Minus, Pause, Play, RotateCcw } from "lucide-react";

export interface WaterStation {
  id: string;
  name: string;
  type: "reservoir" | "channel" | "tank";
  currentLevel: number;
  invertLevel: number;
  bankLevel: number;
  tankHeight?: number;
  warningLevel: number;
  criticalLevel: number;
  trend: "up" | "down" | "stable";
  note: string;
}

type Status = "normal" | "warning" | "critical";

function getStatus(station: WaterStation): Status {
  if (station.currentLevel >= station.criticalLevel) return "critical";
  if (station.currentLevel >= station.warningLevel) return "warning";
  return "normal";
}

function makeTextSprite(text: string, color = 0xd6edf4) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 24px Inter, sans-serif";
  context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
}

function addDepthAxis(world: THREE.Group, maxY: number, station: WaterStation, x: number, z = 0) {
  world.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, maxY + 0.2, z)]),
    new THREE.LineBasicMaterial({ color: 0x9dc4d0, transparent: true, opacity: 0.8 }),
  ));
  const bottom = station.type === "tank" ? 0 : station.invertLevel;
  const top = station.type === "tank" ? (station.tankHeight ?? station.bankLevel) : station.bankLevel;
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = ratio * maxY;
    world.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x - 0.18, y, z), new THREE.Vector3(x + 0.22, y, z)]),
      new THREE.LineBasicMaterial({ color: 0x9dc4d0 }),
    ));
    const label = makeTextSprite((bottom + (top - bottom) * ratio).toFixed(2));
    label.position.set(x - 0.9, y, z);
    label.scale.set(1.25, 0.36, 1);
    world.add(label);
  }
}

function addCurrentLevelMarker(world: THREE.Group, y: number, x: number, value: number, status: Status, z = 0) {
  const color = status === "critical" ? 0xff6678 : status === "warning" ? 0xf3b85b : 0x54e4ff;
  world.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x + 0.9, y, z)]),
    new THREE.LineBasicMaterial({ color }),
  ));
  const label = makeTextSprite(`${value.toFixed(2)} m`, color);
  label.position.set(x + 1.65, y, z);
  label.scale.set(1.9, 0.54, 1);
  world.add(label);
}

function addLevelPlane(world: THREE.Group, width: number, depth: number, y: number, color: number, opacity: number) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = y;
  world.add(plane);
}

function addLevelRing(world: THREE.Group, radius: number, y: number, color: number) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 10, 64), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y + 0.08;
  world.add(ring);
}

function makeParabolicHalfBowl(radius: number, depth: number, radialSegments = 60, ringSegments = 28) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  for (let ring = 0; ring <= ringSegments; ring += 1) {
    const rr = radius * (ring / ringSegments);
    const y = depth * Math.pow(rr / radius, 2);
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const theta = Math.PI + Math.PI * (segment / radialSegments);
      positions.push(rr * Math.cos(theta), y, rr * Math.sin(theta));
      const tone = ring / ringSegments;
      color.setRGB(0.22 - tone * 0.06, 0.31 + tone * 0.05, 0.24 - tone * 0.04);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < ringSegments; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const a = ring * (radialSegments + 1) + segment;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addReservoirLevelArc(world: THREE.Group, radius: number, maxDepth: number, y: number, color: number) {
  const levelRadius = radius * Math.sqrt(THREE.MathUtils.clamp(y / maxDepth, 0.01, 1));
  const curve = new THREE.EllipseCurve(0, 0, levelRadius, levelRadius, Math.PI, Math.PI * 2);
  const points = curve.getPoints(72).map((point) => new THREE.Vector3(point.x, y + 0.02, point.y));
  world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
}

function createReservoirScene(world: THREE.Group, station: WaterStation, status: Status) {
  const maxDepth = station.bankLevel - station.invertLevel;
  const waterDepth = station.currentLevel - station.invertLevel;
  const radius = 7.4;
  const bowl = new THREE.Mesh(
    makeParabolicHalfBowl(radius, maxDepth),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, side: THREE.DoubleSide }),
  );
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  world.add(bowl);

  const profilePoints: THREE.Vector3[] = [];
  for (let index = 0; index <= 80; index += 1) {
    const x = -radius + (2 * radius * index) / 80;
    profilePoints.push(new THREE.Vector3(x, maxDepth * Math.pow(Math.abs(x) / radius, 2), 0));
  }
  world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(profilePoints), new THREE.LineBasicMaterial({ color: 0xc9d9d6, transparent: true, opacity: 0.82 })));

  const waterRadius = radius * Math.sqrt(THREE.MathUtils.clamp(waterDepth / maxDepth, 0.02, 1));
  const waterGeometry = new THREE.CircleGeometry(waterRadius, 64, Math.PI, Math.PI);
  const water = new THREE.Mesh(waterGeometry, new THREE.MeshStandardMaterial({ color: 0x4fe3ff, emissive: 0x0d566c, emissiveIntensity: 0.58, transparent: true, opacity: 0.9, roughness: 0.08, side: THREE.DoubleSide }));
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = Math.PI;
  water.position.y = waterDepth + 0.04;
  world.add(water);

  const cutShape = new THREE.Shape();
  cutShape.moveTo(-waterRadius, waterDepth);
  for (let index = 0; index <= 60; index += 1) {
    const x = -waterRadius + (2 * waterRadius * index) / 60;
    cutShape.lineTo(x, maxDepth * Math.pow(Math.abs(x) / radius, 2));
  }
  cutShape.lineTo(waterRadius, waterDepth);
  cutShape.closePath();
  const cutFace = new THREE.Mesh(new THREE.ShapeGeometry(cutShape), new THREE.MeshPhysicalMaterial({ color: 0x159fc8, emissive: 0x063e53, emissiveIntensity: 0.32, transparent: true, opacity: 0.72, roughness: 0.12, side: THREE.DoubleSide }));
  cutFace.position.z = 0.035;
  world.add(cutFace);

  addReservoirLevelArc(world, radius, maxDepth, station.warningLevel - station.invertLevel, 0xf3b85b);
  addReservoirLevelArc(world, radius, maxDepth, station.criticalLevel - station.invertLevel, 0xff6678);
  addDepthAxis(world, maxDepth, station, -radius - 1.35);
  addCurrentLevelMarker(world, waterDepth, waterRadius + 0.25, station.currentLevel, status, 0.06);
  world.position.y = 0.15;

  const position = waterGeometry.attributes.position as THREE.BufferAttribute;
  const baseZ = Array.from({ length: position.count }, (_, index) => position.getZ(index));
  return (time: number) => {
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      position.setZ(index, baseZ[index] + Math.sin(x + time * 1.7) * 0.065 + Math.cos(y * 1.3 - time * 1.35) * 0.045);
    }
    position.needsUpdate = true;
    waterGeometry.computeVertexNormals();
  };
}

function getWaterChannelShape(bottomWidth: number, topWidth: number, maxDepth: number, waterDepth: number) {
  const width = bottomWidth + (topWidth - bottomWidth) * THREE.MathUtils.clamp(waterDepth / maxDepth, 0, 1);
  const shape = new THREE.Shape();
  shape.moveTo(-bottomWidth / 2, 0);
  shape.lineTo(bottomWidth / 2, 0);
  shape.lineTo(width / 2, waterDepth);
  shape.lineTo(-width / 2, waterDepth);
  shape.closePath();
  return shape;
}

function createChannelScene(world: THREE.Group, station: WaterStation, status: Status) {
  const maxDepth = station.bankLevel - station.invertLevel;
  const waterDepth = station.currentLevel - station.invertLevel;
  const bottomWidth = 2.6;
  const topWidth = 6.2;
  const extrudeDepth = 4.8;
  const halfZ = extrudeDepth / 2;
  const trough = new THREE.BufferGeometry();
  trough.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    -bottomWidth / 2, 0, -halfZ, bottomWidth / 2, 0, -halfZ, bottomWidth / 2, 0, halfZ, -bottomWidth / 2, 0, halfZ,
    -topWidth / 2, maxDepth, -halfZ, -bottomWidth / 2, 0, -halfZ, -bottomWidth / 2, 0, halfZ, -topWidth / 2, maxDepth, halfZ,
    bottomWidth / 2, 0, -halfZ, topWidth / 2, maxDepth, -halfZ, topWidth / 2, maxDepth, halfZ, bottomWidth / 2, 0, halfZ,
  ]), 3));
  trough.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
  trough.computeVertexNormals();
  const troughMesh = new THREE.Mesh(trough, new THREE.MeshStandardMaterial({ color: 0x55615b, roughness: 0.92, side: THREE.DoubleSide }));
  troughMesh.castShadow = true;
  troughMesh.receiveShadow = true;
  world.add(troughMesh);

  const outline = [new THREE.Vector3(-topWidth / 2, maxDepth, halfZ), new THREE.Vector3(-bottomWidth / 2, 0, halfZ), new THREE.Vector3(bottomWidth / 2, 0, halfZ), new THREE.Vector3(topWidth / 2, maxDepth, halfZ)];
  world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), new THREE.LineBasicMaterial({ color: 0xc2d5d8, transparent: true, opacity: 0.72 })));

  const waterGeometry = new THREE.ExtrudeGeometry(getWaterChannelShape(bottomWidth, topWidth, maxDepth, waterDepth), { depth: extrudeDepth - 0.34, bevelEnabled: false });
  waterGeometry.translate(0, 0, -(extrudeDepth - 0.34) / 2);
  world.add(new THREE.Mesh(waterGeometry, new THREE.MeshPhysicalMaterial({ color: 0x1daed2, emissive: 0x063848, emissiveIntensity: 0.24, transparent: true, opacity: 0.78, roughness: 0.13, ior: 1.33, side: THREE.DoubleSide })));

  const waterTopWidth = bottomWidth + (topWidth - bottomWidth) * THREE.MathUtils.clamp(waterDepth / maxDepth, 0, 1);
  const surfaceGeometry = new THREE.PlaneGeometry(waterTopWidth, extrudeDepth - 0.42, 34, 20);
  const surface = new THREE.Mesh(surfaceGeometry, new THREE.MeshStandardMaterial({ color: 0x58e5ff, emissive: 0x0e5166, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, roughness: 0.09, side: THREE.DoubleSide }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = waterDepth + 0.045;
  world.add(surface);

  addLevelPlane(world, topWidth + 0.8, extrudeDepth + 0.25, station.warningLevel - station.invertLevel, 0xf3b85b, 0.2);
  addLevelPlane(world, topWidth + 0.8, extrudeDepth + 0.25, station.criticalLevel - station.invertLevel, 0xff6678, 0.24);
  addDepthAxis(world, maxDepth, station, -4.65);
  addCurrentLevelMarker(world, waterDepth, waterTopWidth / 2 + 0.25, station.currentLevel, status, halfZ + 0.08);
  world.position.y = 0.12;

  const position = surfaceGeometry.attributes.position as THREE.BufferAttribute;
  const baseZ = Array.from({ length: position.count }, (_, index) => position.getZ(index));
  return (time: number) => {
    for (let index = 0; index < position.count; index += 1) {
      position.setZ(index, baseZ[index] + Math.sin(position.getX(index) * 1.7 + time * 2.05) * 0.055 + Math.cos(position.getY(index) * 1.9 - time * 1.55) * 0.045);
    }
    position.needsUpdate = true;
    surfaceGeometry.computeVertexNormals();
  };
}

function createTankScene(world: THREE.Group, station: WaterStation, status: Status) {
  const height = station.tankHeight ?? station.bankLevel;
  const radius = 2.2;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * 0.22, Math.PI * 1.56), new THREE.MeshStandardMaterial({ color: 0x8698a2, roughness: 0.48, metalness: 0.34, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  world.add(shell);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.16, 64), new THREE.MeshStandardMaterial({ color: 0x687981, roughness: 0.68, metalness: 0.22 }));
  bottom.position.y = 0.08;
  world.add(bottom);
  const waterBody = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.91, radius * 0.91, station.currentLevel, 64), new THREE.MeshPhysicalMaterial({ color: 0x0eadd9, emissive: 0x063f56, emissiveIntensity: 0.48, transparent: true, opacity: 0.88, roughness: 0.08, transmission: 0.08, ior: 1.33 }));
  waterBody.position.y = station.currentLevel / 2 + 0.08;
  world.add(waterBody);
  const surfaceGeometry = new THREE.CircleGeometry(radius * 0.91, 64);
  const surface = new THREE.Mesh(surfaceGeometry, new THREE.MeshStandardMaterial({ color: 0x69eaff, emissive: 0x0a5770, emissiveIntensity: 0.65, transparent: true, opacity: 0.96, roughness: 0.06, side: THREE.DoubleSide }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = station.currentLevel + 0.08;
  world.add(surface);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.55, Math.max(0.1, station.currentLevel)), new THREE.MeshBasicMaterial({ color: 0x19bfe9, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
  face.position.set(0, station.currentLevel / 2 + 0.08, radius * 0.73);
  world.add(face);
  addLevelRing(world, radius * 1.025, station.warningLevel, 0xf3b85b);
  addLevelRing(world, radius * 1.05, station.criticalLevel, 0xff6678);
  addDepthAxis(world, height, station, -3.65);
  addCurrentLevelMarker(world, station.currentLevel, radius + 0.08, station.currentLevel, status, radius * 0.8);
  world.position.y = 0.12;
  const position = surfaceGeometry.attributes.position as THREE.BufferAttribute;
  const baseZ = Array.from({ length: position.count }, (_, index) => position.getZ(index));
  return (time: number) => {
    for (let index = 0; index < position.count; index += 1) {
      position.setZ(index, baseZ[index] + Math.sin(position.getX(index) * 2.1 + time * 1.8) * 0.045 + Math.cos(position.getY(index) * 2.5 - time * 1.4) * 0.035);
    }
    position.needsUpdate = true;
    surfaceGeometry.computeVertexNormals();
  };
}

export function WaterProfile3D({ station, featured = false }: { station: WaterStation; featured?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const resetViewRef = useRef<() => void>(() => undefined);
  const motionRef = useRef(true);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const status = getStatus(station);
  const topLevel = station.type === "tank" ? (station.tankHeight ?? station.bankLevel) : station.bankLevel;
  const waterDepth = station.type === "tank" ? station.currentLevel : station.currentLevel - station.invertLevel;
  const freeboard = topLevel - station.currentLevel;
  const capacity = THREE.MathUtils.clamp((waterDepth / (topLevel - station.invertLevel)) * 100, 0, 100);
  const scaleRows = [
    { label: station.type === "tank" ? "ขอบถัง" : station.type === "reservoir" ? "สันอ่าง" : "ตลิ่ง", value: topLevel, kind: "normal" },
    { label: "วิกฤต", value: station.criticalLevel, kind: "critical" },
    { label: "เฝ้าระวัง", value: station.warningLevel, kind: "warning" },
    { label: "ระดับปัจจุบัน", value: station.currentLevel, kind: status },
    { label: station.type === "tank" ? "ก้นถัง" : station.type === "reservoir" ? "ก้นอ่าง" : "ท้องคลอง", value: station.invertLevel, kind: "normal" },
  ];

  useEffect(() => { motionRef.current = motionEnabled; }, [motionEnabled]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08161d);
    scene.fog = new THREE.FogExp2(0x08161d, station.type === "reservoir" ? 0.021 : 0.037);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = station.type === "reservoir" ? 8 : 4;
    controls.maxDistance = station.type === "reservoir" ? 30 : 18;
    controls.maxPolarAngle = Math.PI * 0.48;

    scene.add(new THREE.HemisphereLight(0xbfefff, 0x143229, 1.38));
    const key = new THREE.DirectionalLight(0xeefcff, 1.95);
    key.position.set(6, 11, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x47d6ea, 0.78);
    rim.position.set(-6, 4, -7);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(station.type === "reservoir" ? 18 : 10, 64), new THREE.MeshStandardMaterial({ color: 0x091116, roughness: 0.98 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);
    const world = new THREE.Group();
    scene.add(world);

    const animateWater = station.type === "reservoir" ? createReservoirScene(world, station, status) : station.type === "channel" ? createChannelScene(world, station, status) : createTankScene(world, station, status);
    const resetView = () => {
      if (station.type === "reservoir") { camera.position.set(11.5, 9.4, 13.8); controls.target.set(0, 2.5, -0.8); }
      else if (station.type === "tank") { camera.position.set(7.3, 5.8, 8.8); controls.target.set(0, (station.tankHeight ?? station.bankLevel) * 0.46, 0); }
      else { const height = station.bankLevel - station.invertLevel; const distance = Math.max(8.3, height * 1.55); camera.position.set(distance * 0.82, height * 0.45 + distance * 0.42, distance); controls.target.set(0, Math.max(1.8, height * 0.45), 0); }
      controls.update();
    };
    resetViewRef.current = resetView;
    resetView();
    const animationStartedAt = performance.now();
    let animationFrame = 0;
    const render = () => {
      if (motionRef.current) animateWater((performance.now() - animationStartedAt) / 1_000);
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();
    const observer = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite)) return;
        const disposable = object as THREE.Mesh;
        disposable.geometry?.dispose();
        const materials = Array.isArray(disposable.material) ? disposable.material : [disposable.material];
        materials.forEach((material: any) => { material?.map?.dispose?.(); material?.dispose?.(); });
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [station, status]);

  const statusLabel = status === "critical" ? "วิกฤต" : status === "warning" ? "เฝ้าระวัง" : "ปกติ";
  const trendLabel = station.trend === "up" ? "กำลังสูงขึ้น" : station.trend === "down" ? "กำลังลดลง" : "ทรงตัว";

  return (
    <article className={`water-station-card ${featured ? "featured" : ""} status-${status}`}>
      <header className="water-card-header">
        <div><div className="station-code-row"><span className="station-code">{station.id}</span><span className={`status-badge ${status}`}>{statusLabel}</span></div><h3>{station.name}</h3></div>
        <span className={`trend-chip ${station.trend}`}>{station.trend === "up" ? <ArrowUp size={13} /> : station.trend === "down" ? <ArrowDown size={13} /> : <Minus size={13} />}{trendLabel}</span>
      </header>
      <div className="water-card-metrics">
        <div><span>ระดับปัจจุบัน</span><strong>{station.currentLevel.toFixed(2)} <small>ม.</small></strong></div>
        <div><span>ความลึกน้ำ</span><strong>{waterDepth.toFixed(2)} <small>ม.</small></strong></div>
        <div><span>ระยะเผื่อ</span><strong className={freeboard < 0 ? "danger-text" : ""}>{freeboard.toFixed(2)} <small>ม.</small></strong></div>
      </div>
      <div className="water-card-body">
        <div className="three-scene-wrap">
          <div ref={mountRef} className="three-scene" />
          <div className="scene-badge"><span className="live-dot" /> LIVE 3D</div>
          <div className="scene-controls">
            <button onClick={() => { setMotionEnabled((current) => !current); motionRef.current = !motionRef.current; }} aria-label={motionEnabled ? "หยุดการเคลื่อนไหวน้ำ" : "เล่นการเคลื่อนไหวน้ำ"}>{motionEnabled ? <Pause size={14} /> : <Play size={14} />}</button>
            <button onClick={() => resetViewRef.current()} aria-label="คืนมุมมอง 3D"><RotateCcw size={14} /></button>
          </div>
          <div className="scene-legend"><span><i className="water" />ระดับน้ำ</span><span><i className="warning" />เฝ้าระวัง</span><span><i className="critical" />วิกฤต</span></div>
        </div>
        <div className="level-scale">
          <p>ระดับอ้างอิง <span>ม.รทก.</span></p>
          {scaleRows.map((row) => <div key={row.label} className="scale-row"><span>{row.label}</span><strong className={row.kind}>{row.value.toFixed(2)}</strong></div>)}
          <div className="capacity-block"><div><span>ความจุระดับใช้งาน</span><strong>{capacity.toFixed(0)}%</strong></div><div className="capacity-track"><span className={status} style={{ width: `${capacity}%` }} /></div></div>
        </div>
      </div>
      <footer className="water-card-footer"><p>{station.note}</p><span>ลากเพื่อหมุน · เลื่อนเพื่อซูม</span></footer>
    </article>
  );
}
