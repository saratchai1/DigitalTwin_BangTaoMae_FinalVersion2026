import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Droplets, Map, ArrowUp, ArrowDown, Minus, Monitor, Activity } from 'lucide-react';

interface Station {
  id: string;
  name: string;
  val: number;
  baseMSL: number;
  warningLevel: number;
  criticalLevel: number;
  type: string;
  trend: string;
}

export const WaterProfile3D = ({ station }: { station: Station }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const level = station.val;
  const criticalLevel = station.criticalLevel;
  const warningLevel = station.warningLevel;
  const baseLevel = station.baseMSL;
  const isOverflow = level > criticalLevel;
  const percentFull = Math.min(((level - baseLevel) / (criticalLevel - baseLevel)) * 100, 100).toFixed(2);
  const freeboard = (criticalLevel - level).toFixed(2);

  // Map app station to 3D patch format
  const s = {
    type: station.type === 'tank' ? 'tank' : 'channel',
    currentLevel: level,
    invertLevel: baseLevel,
    warningLevel: warningLevel,
    criticalLevel: criticalLevel,
    bankLevel: criticalLevel + ((criticalLevel - baseLevel) * 0.1),
    tankHeight: criticalLevel + ((criticalLevel - baseLevel) * 0.1),
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const host = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = null; // Transparent background to show tailwind bg
    // scene.fog = new THREE.FogExp2(0x091218, 0.038); // Remove fog for transparent bg

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 80);
    camera.position.set(7.2, 5.8, 8.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.target.set(0, 1.85, 0);

    scene.add(new THREE.HemisphereLight(0xbfefff, 0x133024, 1.3));

    const key = new THREE.DirectionalLight(0xeefcff, 1.9);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x47d6ea, 0.8);
    rim.position.set(-5, 3, -6);
    scene.add(rim);

    // Make the floor more subtle or remove it for better integration with cards
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(10, 48),
      new THREE.MeshStandardMaterial({ color: 0x091116, roughness: 0.98, transparent: true, opacity: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    const world = new THREE.Group();
    scene.add(world);

    const clock = new THREE.Clock();
    let animateWater: (t: number) => void;

    // --- Helper Functions from Patch ---
    function makeTextSprite(text: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 72;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Sprite();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(7, 16, 20, 0.0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillStyle = '#d6edf4'; // Adjust color based on theme if needed
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      return new THREE.Sprite(material);
    }

    function addDepthAxis(worldGroup: THREE.Group, maxY: number, invertLevel: number, topLevel: number) {
      const axisHeight = maxY + 0.3;
      const points = [
        new THREE.Vector3(-4.6, 0, 0),
        new THREE.Vector3(-4.6, axisHeight, 0),
      ];
      const axis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x9dc4d0 })
      );
      worldGroup.add(axis);

      const tickCount = 4;
      for (let i = 0; i <= tickCount; i++) {
        const ratio = i / tickCount;
        const y = ratio * maxY;
        const tick = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-4.8, y, 0),
            new THREE.Vector3(-4.35, y, 0),
          ]),
          new THREE.LineBasicMaterial({ color: 0x9dc4d0 })
        );
        worldGroup.add(tick);

        const actualValue = invertLevel + (topLevel - invertLevel) * ratio;
        const sprite = makeTextSprite(actualValue.toFixed(2));
        sprite.position.set(-5.55, y, 0);
        sprite.scale.set(1.2, 0.34, 1);
        worldGroup.add(sprite);
      }
    }

    function addLevelPlane(worldGroup: THREE.Group, width: number, depth: number, y: number, color: number, opacity: number) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(0, y, 0);
      worldGroup.add(plane);
    }

    function addLevelRing(worldGroup: THREE.Group, radius: number, y: number, color: number) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.045, 10, 60),
        new THREE.MeshBasicMaterial({ color })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      worldGroup.add(ring);
    }

    function getWaterChannelShape(bottomWidth: number, topWidth: number, maxDepth: number, waterDepth: number) {
      const widthAtSurface = bottomWidth + (topWidth - bottomWidth) * THREE.MathUtils.clamp(waterDepth / maxDepth, 0, 1);
      const shape = new THREE.Shape();
      shape.moveTo(-bottomWidth / 2, 0);
      shape.lineTo(bottomWidth / 2, 0);
      shape.lineTo(widthAtSurface / 2, waterDepth);
      shape.lineTo(-widthAtSurface / 2, waterDepth);
      shape.closePath();
      return shape;
    }

    function buildChannelScene() {
      const maxDepth = s.bankLevel - s.invertLevel;
      const waterDepth = s.currentLevel - s.invertLevel;
      const warningDepth = s.warningLevel - s.invertLevel;
      const criticalDepth = s.criticalLevel - s.invertLevel;

      const bottomWidth = 2.4;
      const topWidth = 6.4;
      const extrudeDepth = 4.8;
      const leftTop = -topWidth / 2;
      const rightTop = topWidth / 2;
      const leftBottom = -bottomWidth / 2;
      const rightBottom = bottomWidth / 2;

      const soilShape = new THREE.Shape();
      soilShape.moveTo(leftTop, maxDepth);
      soilShape.lineTo(rightTop, maxDepth);
      soilShape.lineTo(rightBottom, 0);
      soilShape.lineTo(leftBottom, 0);
      soilShape.closePath();

      const channelGeo = new THREE.ExtrudeGeometry(soilShape, {
        depth: extrudeDepth,
        bevelEnabled: false,
        curveSegments: 24,
      });
      channelGeo.center();

      const channel = new THREE.Mesh(
        channelGeo,
        new THREE.MeshStandardMaterial({ color: 0x384235, roughness: 0.95, metalness: 0.02 })
      );
      channel.castShadow = true;
      channel.receiveShadow = true;
      world.add(channel);

      const concreteFloor = new THREE.Mesh(
        new THREE.BoxGeometry(bottomWidth + 0.08, 0.18, extrudeDepth - 0.1),
        new THREE.MeshStandardMaterial({ color: 0x4d5459, roughness: 0.8 })
      );
      concreteFloor.position.set(0, 0.08, 0);
      concreteFloor.castShadow = true;
      concreteFloor.receiveShadow = true;
      world.add(concreteFloor);

      const waterGroup = new THREE.Group();
      world.add(waterGroup);

      const waterShape = getWaterChannelShape(bottomWidth, topWidth, maxDepth, waterDepth);
      const waterGeo = new THREE.ExtrudeGeometry(waterShape, {
        depth: extrudeDepth - 0.28,
        bevelEnabled: false,
        curveSegments: 24,
      });
      waterGeo.center();

      const waterBody = new THREE.Mesh(
        waterGeo,
        new THREE.MeshPhysicalMaterial({
          color: 0x1faed5,
          transmission: 0.24,
          transparent: true,
          opacity: 0.9,
          roughness: 0.16,
          metalness: 0.0,
          thickness: 0.8,
          ior: 1.33,
        })
      );
      waterBody.position.y = 0.02;
      waterBody.castShadow = true;
      waterBody.receiveShadow = true;
      waterGroup.add(waterBody);

      const waterTopWidth = bottomWidth + (topWidth - bottomWidth) * THREE.MathUtils.clamp(waterDepth / maxDepth, 0, 1);
      const topPlaneGeo = new THREE.PlaneGeometry(waterTopWidth, extrudeDepth - 0.4, 32, 20);
      const topPlaneMat = new THREE.MeshStandardMaterial({
        color: 0x59e3ff,
        emissive: 0x0d4b60,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.82,
        roughness: 0.12,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const topSurface = new THREE.Mesh(topPlaneGeo, topPlaneMat);
      topSurface.rotation.x = -Math.PI / 2;
      topSurface.position.set(0, waterDepth, 0);
      waterGroup.add(topSurface);

      addLevelPlane(world, topWidth + 1.4, extrudeDepth + 1.2, warningDepth, 0xf1c96d, 0.6);
      addLevelPlane(world, topWidth + 1.4, extrudeDepth + 1.2, criticalDepth, 0xff6d7e, 0.85);
      addDepthAxis(world, maxDepth, s.invertLevel, s.bankLevel);

      world.position.y = 0.2;

      const surfacePositions = topPlaneGeo.attributes.position;
      return (t: number) => {
        for (let i = 0; i < surfacePositions.count; i++) {
          const x = surfacePositions.getX(i);
          const z = surfacePositions.getY(i);
          const wave = Math.sin(x * 1.5 + t * 2.1) * 0.06 + Math.cos(z * 1.75 - t * 1.65) * 0.05;
          surfacePositions.setZ(i, wave);
        }
        surfacePositions.needsUpdate = true;
        topPlaneGeo.computeVertexNormals();
        const bob = Math.sin(t * 2.2) * 0.008;
        waterBody.position.y = 0.02 + bob;
      };
    }

    function buildTankScene() {
      const maxHeight = s.tankHeight - s.invertLevel;
      const waterHeight = Math.max(0.1, s.currentLevel - s.invertLevel);
      const warningDepth = s.warningLevel - s.invertLevel;
      const criticalDepth = s.criticalLevel - s.invertLevel;
      const radius = 2.2;

      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, maxHeight, 48, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x7d8e97, roughness: 0.52, metalness: 0.34, side: THREE.DoubleSide })
      );
      shell.position.y = maxHeight / 2;
      shell.castShadow = true;
      shell.receiveShadow = true;
      world.add(shell);

      const bottom = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.18, 48),
        new THREE.MeshStandardMaterial({ color: 0x67747b, roughness: 0.7, metalness: 0.25 })
      );
      bottom.position.y = 0.09;
      bottom.receiveShadow = true;
      world.add(bottom);

      const roofRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.08, 16, 48),
        new THREE.MeshStandardMaterial({ color: 0xa8b5bc, roughness: 0.4, metalness: 0.45 })
      );
      roofRing.rotation.x = Math.PI / 2;
      roofRing.position.y = maxHeight;
      world.add(roofRing);

      const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x20b6da,
        transmission: 0.28,
        transparent: true,
        opacity: 0.9,
        roughness: 0.12,
        metalness: 0.0,
        ior: 1.33,
        thickness: 0.8,
      });

      const waterCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, waterHeight, 48),
        waterMaterial
      );
      waterCylinder.position.y = waterHeight / 2;
      waterCylinder.castShadow = true;
      waterCylinder.receiveShadow = true;
      world.add(waterCylinder);

      const topGeo = new THREE.CircleGeometry(radius * 0.92, 40);
      const topMat = new THREE.MeshStandardMaterial({
        color: 0x61e6ff,
        emissive: 0x0f4b61,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.rotation.x = -Math.PI / 2;
      top.position.y = waterHeight;
      world.add(top);

      addLevelRing(world, radius * 1.03, warningDepth, 0xf1c96d);
      addLevelRing(world, radius * 1.06, criticalDepth, 0xff6d7e);
      addDepthAxis(world, maxHeight, s.invertLevel, s.tankHeight);

      world.position.y = 0.15;

      const positions = topGeo.attributes.position;
      return (t: number) => {
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const wave = Math.sin(x * 2.2 + t * 2.0) * 0.05 + Math.cos(y * 2.6 - t * 1.6) * 0.05;
          positions.setZ(i, wave);
        }
        positions.needsUpdate = true;
        topGeo.computeVertexNormals();
        waterCylinder.position.y = waterHeight / 2 + Math.sin(t * 1.9) * 0.008;
      };
    }

    if (s.type === 'channel') {
      animateWater = buildChannelScene();
    } else {
      animateWater = buildTankScene();
    }
    // --- End Helper Functions ---

    let animationId: number;
    function render() {
      const elapsed = clock.getElapsedTime();
      if (animateWater) animateWater(elapsed);
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    }
    render();

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [station.val]); // re-run if val changes significantly, or ideally we'd just update the mesh

  return (
    <div className="bg-panel/80 backdrop-blur-md rounded-xl border border-border shadow-xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:border-accent">
      <div className="p-3 border-b border-border/50 flex justify-between items-center bg-main/50">
        <div className="flex items-center gap-2 font-bold text-sm text-text-main tracking-wide">
          {station.type === 'tank' ? <Droplets className="h-4 w-4 text-accent"/> : <Map className="h-4 w-4 text-accent"/>}
          <span>{station.id}: {station.name}</span>
        </div>
        <div className={`text-[10px] px-3 py-1 rounded-full font-bold text-white shadow-inner ${level >= criticalLevel ? 'bg-danger/90' : level >= warningLevel ? 'bg-warning/90' : 'bg-success/90'}`}>
          {level >= criticalLevel ? 'CRITICAL' : level >= warningLevel ? 'WARNING' : 'NORMAL'}
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row p-4 gap-4 h-auto md:h-72">
        {/* Left: 3D Stream */}
        <div className="w-full md:w-[65%] relative rounded-lg overflow-hidden flex items-center justify-center border border-border/30 shadow-inner bg-gradient-to-b from-gray-900 to-gray-800">
          <div ref={mountRef} className="w-full h-full min-h-[200px]" />
          <div className="absolute bottom-2 right-2 flex gap-1 z-10">
            <div className="bg-black/50 backdrop-blur-sm text-white p-1.5 rounded cursor-pointer hover:bg-accent/80 transition-colors"><Monitor className="w-3.5 h-3.5" /></div>
            <div className="bg-black/50 backdrop-blur-sm text-white p-1.5 rounded cursor-pointer hover:bg-accent/80 transition-colors"><Activity className="w-3.5 h-3.5" /></div>
          </div>
          <div className="absolute top-2 left-2 text-[10px] font-mono font-semibold tracking-widest text-white/70 bg-black/30 px-2 py-0.5 rounded backdrop-blur">
            LIVE 3D VIEW
          </div>
        </div>

        {/* Right: Stats */}
        <div className="w-full md:w-[35%] flex flex-col justify-between py-1 gap-4">
          <div className="bg-main/40 p-4 rounded-xl border border-border/20">
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Current Level</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold font-mono tracking-tighter ${level >= criticalLevel ? 'text-danger' : level >= warningLevel ? 'text-warning' : 'text-success'}`}>{Number(level).toFixed(2)}</span>
              <span className="text-xs text-text-muted font-bold">m.</span>
            </div>
            <div className="text-[10px] text-text-muted flex items-center gap-1 mt-2 bg-black/10 inline-flex px-2 py-1 rounded">
              {station.trend === 'up' ? <ArrowUp className="w-3 h-3 text-danger" /> : station.trend === 'down' ? <ArrowDown className="w-3 h-3 text-success" /> : <Minus className="w-3 h-3" />}
              <span className="font-semibold tracking-wide uppercase">{station.trend === 'up' ? 'Rising' : station.trend === 'down' ? 'Falling' : 'Stable'}</span>
            </div>
          </div>
            
          <div className="space-y-3">
              <div className="px-1">
                <div className="flex justify-between text-[11px] mb-1 font-semibold uppercase tracking-wider">
                  <span className="text-text-muted">Capacity</span>
                  <span className="text-text-main">{isOverflow ? '100%+' : `${percentFull}%`}</span>
                </div>
                <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden shadow-inner">
                   <div className={`h-full transition-all duration-1000 ${level >= criticalLevel ? 'bg-danger' : level >= warningLevel ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(Number(percentFull), 100)}%` }}></div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-main/40 border border-border/20 flex justify-between items-center">
                 <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider">Freeboard</p>
                 <p className={`text-sm font-mono font-bold ${isOverflow ? 'text-danger' : 'text-text-main'}`}>{isOverflow ? `+${Math.abs(Number(freeboard)).toFixed(2)}` : `+${freeboard}`} m.</p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
