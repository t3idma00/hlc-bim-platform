"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type ThreeRoomModel } from "../converters/roomToThree";

type UseThreeRoomResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  controls: ThreeRoomControls;
};

export type ThreeRoomCameraPreset = "default" | "top" | "front" | "side";

export type ThreeRoomControls = {
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setCameraPreset: (preset: ThreeRoomCameraPreset) => void;
  setRoofAndCeilingVisible: (visible: boolean) => void;
};

export type ThreeRoomTool = "orbit" | "select";

export type SolarSnapshotLike = {
  azimuth: number;
  zenith: number;
  altitude: number;
};

export type SolarStateLike = {
  status: "loading" | "ready" | "unsupported" | "denied" | "error";
  snapshot: SolarSnapshotLike | null;
  message: string;
};

export function useThreeRoom(
  roomModel: ThreeRoomModel | null,
  solarState?: SolarStateLike,
  activeTool: ThreeRoomTool = "orbit"
): UseThreeRoomResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const roomGroupRef = useRef<THREE.Group | null>(null);
  const axesHelperRef = useRef<THREE.Group | null>(null);
  const sunHelperRef = useRef<THREE.Group | null>(null);
  const selectionHelperRef = useRef<THREE.BoxHelper | null>(null);
  const activeToolRef = useRef<ThreeRoomTool>("orbit");
  const roofAndCeilingVisibleRef = useRef(false);
  const frameRequestRef = useRef<number | null>(null);
  const framedOnceRef = useRef(false);
  const lastDimensionsRef = useRef({
    width: 6,
    depth: 6,
    height: 3,
  });

  const frameCamera = useCallback((preset: ThreeRoomCameraPreset = "default") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) {
      return;
    }

    const dimensions = lastDimensionsRef.current;
    const sizeReference = Math.max(dimensions.width, dimensions.depth, dimensions.height, 3);
    const cameraDistance = Math.max(sizeReference * 1.6, 8);
    const targetY = dimensions.height / 2;

    controls.target.set(0, targetY, 0);

    if (preset === "top") {
      camera.position.set(0, Math.max(sizeReference * 2.3, 9), 0.01);
    } else if (preset === "front") {
      camera.position.set(0, targetY + sizeReference * 0.28, Math.max(sizeReference * 2, 9));
    } else if (preset === "side") {
      camera.position.set(Math.max(sizeReference * 2, 9), targetY + sizeReference * 0.28, 0);
    } else {
      camera.position.set(cameraDistance, cameraDistance * 0.75, cameraDistance);
    }

    camera.near = 0.1;
    camera.far = Math.max(sizeReference * 20, 500);
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

  const zoomCameraBy = useCallback((factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) {
      return;
    }

    const offset = camera.position.clone().sub(controls.target);
    const nextDistance = THREE.MathUtils.clamp(
      offset.length() * factor,
      controls.minDistance,
      controls.maxDistance
    );

    offset.setLength(nextDistance);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }, []);

  const clearSelection = useCallback(() => {
    const scene = sceneRef.current;
    const selectionHelper = selectionHelperRef.current;

    if (scene && selectionHelper) {
      scene.remove(selectionHelper);
      selectionHelper.geometry.dispose();
      const material = selectionHelper.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }

    selectionHelperRef.current = null;
  }, []);

  const setRoofAndCeilingVisible = useCallback((visible: boolean) => {
    roofAndCeilingVisibleRef.current = visible;

    const roomGroup = roomGroupRef.current;
    if (!roomGroup) {
      return;
    }

    roomGroup.traverse((node) => {
      if (node.name === "room-roof" || node.name === "room-ceiling") {
        node.visible = visible;
      }
    });
  }, []);

  useEffect(() => {
    activeToolRef.current = activeTool;

    const controls = controlsRef.current;
    if (controls) {
      controls.enabled = activeTool !== "select";
    }
  }, [activeTool]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(10, 8, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(0, 1.5, 0);
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.1);
    directionalLight.position.set(8, 12, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -18;
    directionalLight.shadow.camera.right = 18;
    directionalLight.shadow.camera.top = 18;
    directionalLight.shadow.camera.bottom = -18;
    directionalLight.shadow.bias = -0.0002;
    directionalLight.shadow.normalBias = 0.03;
    directionalLight.shadow.camera.updateProjectionMatrix();
    directionalLight.target.position.set(0, 1.2, 0);
    scene.add(ambientLight, directionalLight, directionalLight.target);

    const gridHelper = new THREE.GridHelper(60, 60, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = -0.04;
    scene.add(gridHelper);

    const handleResize = () => {
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleResize);

    resizeObserver?.observe(container);
    window.addEventListener("resize", handleResize);
    handleResize();

    const animate = () => {
      frameRequestRef.current = window.requestAnimationFrame(animate);
      selectionHelperRef.current?.update();
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      clearSelection();
      disposeObject3D(roomGroupRef.current);
      disposeObject3D(axesHelperRef.current);
      disposeObject3D(sunHelperRef.current);
      roomGroupRef.current = null;
      axesHelperRef.current = null;
      sunHelperRef.current = null;
      disposeObject3D(gridHelper);
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [clearSelection]);

  useEffect(() => {
    const container = containerRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    if (!container || !scene || !camera) {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      if (activeToolRef.current !== "select") {
        return;
      }

      const roomGroup = roomGroupRef.current;
      if (!roomGroup) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObject(roomGroup, true);
      const selectedObject = intersections.find((intersection) => {
        const mesh = intersection.object as THREE.Mesh;
        return Boolean(mesh.geometry);
      })?.object;

      clearSelection();

      if (!selectedObject) {
        return;
      }

      const helper = new THREE.BoxHelper(selectedObject, 0x2563eb);
      helper.name = "selected-object-helper";
      helper.renderOrder = 1500;
      helper.material.depthTest = false;
      helper.material.depthWrite = false;
      scene.add(helper);
      selectionHelperRef.current = helper;
    };

    container.addEventListener("pointerdown", handlePointerDown);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [clearSelection]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!scene || !camera || !controls) {
      return;
    }

    if (roomGroupRef.current) {
      scene.remove(roomGroupRef.current);
      disposeObject3D(roomGroupRef.current);
      roomGroupRef.current = null;
    }

    clearSelection();

    if (axesHelperRef.current) {
      scene.remove(axesHelperRef.current);
      disposeObject3D(axesHelperRef.current);
      axesHelperRef.current = null;
    }

    if (sunHelperRef.current) {
      scene.remove(sunHelperRef.current);
      disposeObject3D(sunHelperRef.current);
      sunHelperRef.current = null;
    }

    const fallbackDimensions = roomModel?.dimensions ?? {
      width: 6,
      depth: 6,
      height: 3,
    };
    lastDimensionsRef.current = fallbackDimensions;
    const sizeReference = Math.max(
      fallbackDimensions.width,
      fallbackDimensions.depth,
      fallbackDimensions.height
    );
    const axesHelper = createFloorAxisHelper(
      fallbackDimensions,
      sizeReference,
      roomModel ? "room" : "origin"
    );
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    if (!roomModel) {
      controls.target.set(0, 0.6, 0);
      controls.minDistance = Math.max(sizeReference * 0.45, 1.5);
      controls.maxDistance = Math.max(sizeReference * 7, 30);
      controls.update();
      return;
    }

    scene.add(roomModel.group);
    roomGroupRef.current = roomModel.group;
    setRoofAndCeilingVisible(roofAndCeilingVisibleRef.current);

    controls.target.set(0, roomModel.dimensions.height / 2, 0);
    controls.minDistance = Math.max(sizeReference * 0.45, 1.5);
    controls.maxDistance = Math.max(sizeReference * 7, 30);

    if (!framedOnceRef.current) {
      const cameraDistance = Math.max(sizeReference * 1.6, 8);
      camera.position.set(cameraDistance, cameraDistance * 0.75, cameraDistance);
      framedOnceRef.current = true;
    }

    controls.update();
  }, [clearSelection, roomModel]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    if (sunHelperRef.current) {
      scene.remove(sunHelperRef.current);
      disposeObject3D(sunHelperRef.current);
      sunHelperRef.current = null;
    }

    if (!solarState || solarState.status !== "ready" || !solarState.snapshot || solarState.snapshot.altitude <= 0) {
      return;
    }

    const sceneDimensions = roomModel?.dimensions ?? {
      width: 6,
      depth: 6,
      height: 3,
      wallThickness: 0.2,
    };
    const sunHelper = createSunHelper(solarState.snapshot, sceneDimensions);

    scene.add(sunHelper);
    sunHelperRef.current = sunHelper;
  }, [roomModel, solarState]);

  return {
    containerRef,
    controls: {
      resetCamera: () => frameCamera("default"),
      zoomIn: () => zoomCameraBy(0.82),
      zoomOut: () => zoomCameraBy(1.18),
      setCameraPreset: frameCamera,
      setRoofAndCeilingVisible,
    },
  };
}

function createFloorAxisHelper(dimensions: {
  width: number;
  depth: number;
  height: number;
}, sizeReference: number, placement: "room" | "origin") {
  const group = new THREE.Group();
  group.name = "floor-axis-helper";

  const length = Math.max(sizeReference * 0.42, 1.5);
  const lineRadius = Math.max(length * 0.02, 0.02);
  const coneRadius = Math.max(length * 0.06, 0.05);
  const coneHeight = Math.max(length * 0.16, 0.16);
  const anchorOffset = Math.max(sizeReference * 0.48, 1.15);

  const origin =
    placement === "room"
      ? new THREE.Vector3(
          -dimensions.width / 2 - anchorOffset,
          0.04,
          dimensions.depth / 2 + anchorOffset
        )
      : new THREE.Vector3(0, 0.04, 0);
  group.position.copy(origin);

  const xAxis = createAxisArrow(
    new THREE.Vector3(1, 0, 0),
    0xef4444,
    length,
    coneRadius,
    coneHeight,
    lineRadius
  );
  const yAxis = createAxisArrow(
    new THREE.Vector3(0, 1, 0),
    0x22c55e,
    length,
    coneRadius,
    coneHeight,
    lineRadius
  );
  const zAxis = createAxisArrow(
    new THREE.Vector3(0, 0, 1),
    0x3b82f6,
    length,
    coneRadius,
    coneHeight,
    lineRadius
  );
  const labelLift = Math.max(length * 0.07, 0.08);
  const labelOffset = Math.max(length * 0.16, 0.24);

  xAxis.position.set(0, 0, 0);
  yAxis.position.set(0, 0, 0);
  zAxis.position.set(0, 0, 0);

  const xLabel = createAxisLabelSprite("X", "#ef4444");
  xLabel.position.set(length + labelOffset, labelLift, 0);

  const yLabel = createAxisLabelSprite("Y", "#22c55e");
  yLabel.position.set(0, length + labelOffset, 0);

  const zLabel = createAxisLabelSprite("Z", "#3b82f6");
  zLabel.position.set(0, labelLift, length + labelOffset);

  group.add(xAxis, yAxis, zAxis, xLabel, yLabel, zLabel);

  group.traverse((node) => {
    node.renderOrder = 999;
    const mesh = node as THREE.Mesh;
    const material = mesh.material;

    if (!material) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      entry.depthTest = false;
      entry.depthWrite = false;
    });
  });

  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(length * 0.06, 0.06), 16, 16),
    new THREE.MeshBasicMaterial({ color: "#0f172a" })
  );
  hub.renderOrder = 1000;
  hub.position.set(0, 0, 0);
  group.add(hub);

  return group;
}

function createAxisArrow(
  direction: THREE.Vector3,
  color: number,
  length: number,
  coneRadius: number,
  coneHeight: number,
  lineRadius: number
) {
  const arrow = new THREE.ArrowHelper(
    direction.clone().normalize(),
    new THREE.Vector3(0, 0, 0),
    length,
    color,
    coneHeight,
    coneRadius
  );

  arrow.traverse((node) => {
    node.renderOrder = 999;
    const mesh = node as THREE.Mesh;
    const material = mesh.material;

    if (!material) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      entry.depthTest = false;
      entry.depthWrite = false;
    });
  });

  const line = arrow.getObjectByName("line") as THREE.Line | undefined;
  if (line) {
    const lineMaterial = line.material as THREE.LineBasicMaterial | undefined;
    if (lineMaterial) {
      lineMaterial.linewidth = Math.max(lineRadius * 80, 1);
    }
  }

  return arrow;
}

function createAxisLabelSprite(label: "X" | "Y" | "Z", color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.Sprite(
      new THREE.SpriteMaterial({ color, depthTest: false, depthWrite: false })
    );
  }

  const width = canvas.width;
  const height = canvas.height;
  const radius = 20;
  const padding = 12;

  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 4;

  roundRect(context, padding, padding, width - padding * 2, height - padding * 2, radius);
  context.fill();
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = "700 54px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.48, 0.36, 1);
  sprite.renderOrder = 1001;

  return sprite;
}

function createSunHelper(snapshot: SolarSnapshotLike, roomDimensions: {
  width: number;
  depth: number;
  height: number;
}) {
  const group = new THREE.Group();
  group.name = "live-sun-helper";

  const sceneScale = Math.max(roomDimensions.width, roomDimensions.depth, roomDimensions.height, 6);
  const sunWorldPosition = getSunWorldPosition(snapshot, sceneScale);
  const targetWorldPosition = new THREE.Vector3(0, roomDimensions.height * 0.08, 0);
  group.position.set(sunWorldPosition.x, sunWorldPosition.y, sunWorldPosition.z);

  const sunTexture = createSunTexture();
  const sunSize = Math.max(sceneScale * 0.42, 0.8);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  sprite.scale.set(sunSize, sunSize, 1);
  sprite.renderOrder = 1002;
  group.add(sprite);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(sunSize * 0.16, 0.08), 20, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfff7c2,
      depthTest: false,
      depthWrite: false,
    })
  );
  core.renderOrder = 1003;
  group.add(core);

  const linePoints = [
    new THREE.Vector3(0, 0, 0),
    targetWorldPosition.clone().sub(new THREE.Vector3(sunWorldPosition.x, sunWorldPosition.y, sunWorldPosition.z)),
  ];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: Math.max(sceneScale * 0.12, 0.35),
      gapSize: Math.max(sceneScale * 0.08, 0.22),
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    })
  );
  line.computeLineDistances();
  line.renderOrder = 1001;
  group.add(line);

  group.traverse((node) => {
    node.renderOrder = Math.max(node.renderOrder, 1001);
  });

  return group;
}

function createSunTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const center = canvas.width / 2;
  const radius = canvas.width / 2;
  const glow = context.createRadialGradient(center, center, 0, center, center, radius);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.18, "rgba(255, 241, 145, 0.98)");
  glow.addColorStop(0.45, "rgba(245, 158, 11, 0.68)");
  glow.addColorStop(0.75, "rgba(245, 158, 11, 0.18)");
  glow.addColorStop(1, "rgba(245, 158, 11, 0)");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.85)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center, center, radius * 0.18, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function getSunWorldPosition(snapshot: SolarSnapshotLike, sceneScale: number) {
  const azimuthRad = (snapshot.azimuth * Math.PI) / 180;
  const altitudeRad = (snapshot.altitude * Math.PI) / 180;
  const distance = sceneScale * 3.2;
  const horizontal = Math.cos(altitudeRad) * distance;

  return {
    x: Math.sin(azimuthRad) * horizontal,
    y: Math.sin(altitudeRad) * distance,
    z: -Math.cos(azimuthRad) * horizontal,
  };
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const cornerRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + cornerRadius, y);
  context.lineTo(x + width - cornerRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  context.lineTo(x + width, y + height - cornerRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
  context.lineTo(x + cornerRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  context.lineTo(x, y + cornerRadius);
  context.quadraticCurveTo(x, y, x + cornerRadius, y);
  context.closePath();
}

function disposeObject3D(object: THREE.Object3D | null) {
  if (!object) {
    return;
  }

  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const material = mesh.material;

    if (geometry) {
      geometry.dispose();
    }

    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
      return;
    }

    if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const mappedMaterial = material as THREE.Material & {
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
    aoMap?: THREE.Texture | null;
    bumpMap?: THREE.Texture | null;
    displacementMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    envMap?: THREE.Texture | null;
    lightMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    specularMap?: THREE.Texture | null;
  };

  [
    mappedMaterial.map,
    mappedMaterial.alphaMap,
    mappedMaterial.aoMap,
    mappedMaterial.bumpMap,
    mappedMaterial.displacementMap,
    mappedMaterial.emissiveMap,
    mappedMaterial.envMap,
    mappedMaterial.lightMap,
    mappedMaterial.metalnessMap,
    mappedMaterial.normalMap,
    mappedMaterial.roughnessMap,
    mappedMaterial.specularMap,
  ].forEach((texture) => {
    texture?.dispose();
  });

  material.dispose();
}
