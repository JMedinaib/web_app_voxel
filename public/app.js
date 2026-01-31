import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import SunCalc from "suncalc";

console.log("Voxel Builder starting...");

// DOM Elements
const canvas = document.getElementById("sceneCanvas");
const contextMenu = document.getElementById("contextMenu");
const cellInfoEl = document.getElementById("cellInfo");
const uploadBtn = document.getElementById("uploadBtn");
const fitToModelBtn = document.getElementById("fitToModelBtn");
const unfitVoxelBtn = document.getElementById("unfitVoxelBtn");
const deleteVoxelBtn = document.getElementById("deleteVoxelBtn");
const fileInput = document.getElementById("fileInput");
const statusToast = document.getElementById("statusToast");
const filterPanel = document.getElementById("filterPanel");
const toggleAllBtn = document.getElementById("toggleAllBtn");
const categoryBtns = document.querySelectorAll(".category-btn");
const filterCheckboxes = document.querySelectorAll(".filter-item input");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const rotationDisplay = document.getElementById("rotationDisplay");
const renderModeSelect = document.getElementById("renderModeSelect");
const sectionPlaneEnabled = document.getElementById("sectionPlaneEnabled");
const sectionControls = document.getElementById("sectionControls");
const sectionSlider = document.getElementById("sectionSlider");
const sectionValue = document.getElementById("sectionValue");
const sectionFlip = document.getElementById("sectionFlip");
const axisBtns = document.querySelectorAll(".axis-btn");

// Solar panel elements
const solarPanel = document.getElementById("solarPanel");
const toggleSolarPanelBtn = document.getElementById("toggleSolarPanel");
const locationSelect = document.getElementById("locationSelect");
const periodSelect = document.getElementById("periodSelect");
const densitySelect = document.getElementById("densitySelect");
const runAnalysisBtn = document.getElementById("runAnalysisBtn");
const clearAnalysisBtn = document.getElementById("clearAnalysisBtn");
const analysisProgress = document.getElementById("analysisProgress");
const progressFill = document.querySelector(".progress-fill");
const progressText = document.querySelector(".progress-text");
const colorLegend = document.getElementById("colorLegend");
const showSunPathCheckbox = document.getElementById("showSunPath");

// Configuration - 30x30 voxel grid (dimensions in meters)
const GRID_DIVISIONS = 30;
const VOXEL_WIDTH = 6;   // 6 meters wide (X)
const VOXEL_DEPTH = 6;   // 6 meters deep (Z)
const VOXEL_HEIGHT = 3;  // 3 meters tall (Y)
const HALF_WIDTH = VOXEL_WIDTH / 2;
const HALF_DEPTH = VOXEL_DEPTH / 2;
const HALF_HEIGHT = VOXEL_HEIGHT / 2;
const GRID_SIZE_X = GRID_DIVISIONS * VOXEL_WIDTH;   // 36 meters
const GRID_SIZE_Z = GRID_DIVISIONS * VOXEL_DEPTH;   // 36 meters
const MAX_HEIGHT_LEVELS = 10;  // Maximum 10 voxels high (30 meters total)

// Categories with colors (electric pastels matching background)
const CATEGORIES = {
  none:    { name: 'Uncategorized', color: 0x888888 },
  column:  { name: 'Column',        color: 0x00e5a0 },  // Electric mint
  floor:   { name: 'Floor',         color: 0x00d4ff },  // Electric cyan
  stairs:  { name: 'Stairs',        color: 0x7b68ee },  // Electric lavender
  walls:   { name: 'Walls',         color: 0xff6eb4 },  // Electric pink
  facades: { name: 'Facades',       color: 0x40e0d0 },  // Electric turquoise
  roof:    { name: 'Roof',          color: 0xda70d6 }   // Electric orchid
};

// Category visibility state
const categoryVisible = {
  none: true, column: true, floor: true,
  stairs: true, walls: true, facades: true, roof: true
};

// Scene
const scene = new THREE.Scene();
// Transparent background - CSS gradient shows through

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(120, 80, 160);  // Adjusted for 120m x 120m grid in meters
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true; // Enable clipping planes

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lights - strong lighting for model visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.bias = -0.0001;
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 1);
dirLight2.position.set(-50, 50, -50);
scene.add(dirLight2);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemiLight);

// Geometries - voxel is 6m x 3m x 6m (width x height x depth)
const voxelGeo = new THREE.BoxGeometry(VOXEL_WIDTH, VOXEL_HEIGHT, VOXEL_DEPTH);
const wireframeGeo = new THREE.EdgesGeometry(voxelGeo);

// Face highlight planes for different orientations
const faceGeoHorizontal = new THREE.PlaneGeometry(VOXEL_WIDTH, VOXEL_DEPTH);  // Top/bottom faces
const faceGeoVerticalX = new THREE.PlaneGeometry(VOXEL_DEPTH, VOXEL_HEIGHT);  // Left/right faces
const faceGeoVerticalZ = new THREE.PlaneGeometry(VOXEL_WIDTH, VOXEL_HEIGHT);  // Front/back faces

const faceMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff88,
  opacity: 0.5,
  transparent: true,
  side: THREE.DoubleSide,
  depthTest: true
});
const faceHighlight = new THREE.Mesh(faceGeoHorizontal, faceMaterial);
const faceEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
faceHighlight.visible = false;
faceHighlight.userData.isHelper = true; // Mark as helper - exclude from render modes
faceHighlight.renderOrder = 999; // Render last
scene.add(faceHighlight);

// Ghost voxel preview (shows where new voxel will be placed)
const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88, opacity: 0.2, transparent: true, depthTest: true });
const ghostMesh = new THREE.Mesh(voxelGeo, ghostMaterial);
const ghostWireMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
const ghostWire = new THREE.LineSegments(wireframeGeo, ghostWireMat);
ghostMesh.add(ghostWire);
ghostMesh.visible = false;
ghostMesh.userData.isHelper = true; // Mark as helper - exclude from render modes
ghostMesh.renderOrder = 999; // Render last
scene.add(ghostMesh);

function setHighlightColor(hex) {
  faceMaterial.color.setHex(hex);
  faceEdgeMat.color.setHex(hex);
  ghostMaterial.color.setHex(hex);
  ghostWireMat.color.setHex(hex);
}

// Update face highlight geometry based on normal direction
function updateFaceHighlightGeometry(normal) {
  if (Math.abs(normal.y) > 0.5) {
    faceHighlight.geometry = faceGeoHorizontal;
  } else if (Math.abs(normal.x) > 0.5) {
    faceHighlight.geometry = faceGeoVerticalX;
  } else {
    faceHighlight.geometry = faceGeoVerticalZ;
  }
}

// Grid - use larger dimension for square grid
const gridHelper = new THREE.GridHelper(GRID_SIZE_X, GRID_DIVISIONS, 0x000000, 0x888888);
gridHelper.userData.isHelper = true; // Mark as helper
scene.add(gridHelper);

// Ground plane (for raycasting) - invisible material so it won't show in any mode
const planeGeo = new THREE.PlaneGeometry(GRID_SIZE_X, GRID_SIZE_Z);
planeGeo.rotateX(-Math.PI / 2);
const planeMat = new THREE.MeshBasicMaterial({ visible: false, colorWrite: false, depthWrite: false });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.userData.isHelper = true; // Mark as helper - exclude from render modes
scene.add(plane);

// Shadow-receiving ground plane (visible in shadow mode)
const shadowGroundGeo = new THREE.PlaneGeometry(GRID_SIZE_X * 2, GRID_SIZE_Z * 2);
shadowGroundGeo.rotateX(-Math.PI / 2);
const shadowGroundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const shadowGround = new THREE.Mesh(shadowGroundGeo, shadowGroundMat);
shadowGround.position.y = -0.01; // Slightly below grid
shadowGround.receiveShadow = true;
shadowGround.visible = false;
shadowGround.userData.isHelper = true; // Mark as helper
scene.add(shadowGround);

// Raycasting
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objects = [plane];

// State
const voxelData = new Map();
let selectedVoxel = null;
let hoveredVoxel = null; // Track currently hovered voxel
let voxelForUpload = null;  // Stores voxel when upload button is clicked
let voxelsVisible = true;
let currentRenderMode = 'normal';
const savedMaterials = new Map(); // Store original materials for render mode toggle
const edgeLines = new Map(); // Store edge lines for outline mode

// Hover highlight box
const hoverBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const hoverBoxMat = new THREE.MeshBasicMaterial({
  color: 0xffcc00,
  transparent: true,
  opacity: 0.15,
  depthTest: true,
  side: THREE.DoubleSide
});
const hoverBox = new THREE.Mesh(hoverBoxGeo, hoverBoxMat);
hoverBox.visible = false;
hoverBox.userData.isHelper = true;
hoverBox.renderOrder = 10;

// Hover outline
const hoverOutlineMat = new THREE.LineBasicMaterial({ color: 0xffcc00, linewidth: 2 });
const hoverOutlineGeo = new THREE.EdgesGeometry(hoverBoxGeo);
const hoverOutline = new THREE.LineSegments(hoverOutlineGeo, hoverOutlineMat);
hoverOutline.userData.isHelper = true;
hoverOutline.userData.isVoxelWireframe = true;
hoverBox.add(hoverOutline);
scene.add(hoverBox);

// Section Plane
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
let sectionAxis = 'y';
let sectionPosition = 0.5; // 0 to 1
let sectionFlipped = false;
let sectionEnabled = false;


// Loaders
const objLoader = new OBJLoader();
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/libs/draco/");
gltfLoader.setDRACOLoader(dracoLoader);

const STORAGE_KEY = 'voxel_world_v3';

// Utility functions
function snapToGrid(pos) {
  return new THREE.Vector3(
    Math.floor(pos.x / VOXEL_WIDTH) * VOXEL_WIDTH + HALF_WIDTH,
    Math.floor(pos.y / VOXEL_HEIGHT) * VOXEL_HEIGHT + HALF_HEIGHT,
    Math.floor(pos.z / VOXEL_DEPTH) * VOXEL_DEPTH + HALF_DEPTH
  );
}

function getVoxelKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function showToast(message, type = '') {
  statusToast.textContent = message;
  statusToast.className = 'status-toast active ' + type;
  setTimeout(() => {
    statusToast.classList.remove('active');
  }, 2500);
}

// Create voxel with translucent fill + wireframe
function createVoxel(position, category = 'none', rotation = 0, customHeight = null) {
  const color = CATEGORIES[category].color;
  const group = new THREE.Group();
  group.position.copy(position);

  // Translucent fill - more visible
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  const mesh = new THREE.Mesh(voxelGeo, material);
  mesh.renderOrder = 999; // Render after geometry
  group.add(mesh);

  // Wireframe - full opacity for electric look
  const wireMat = new THREE.LineBasicMaterial({ color: color, transparent: false, linewidth: 2 });
  const wireframe = new THREE.LineSegments(wireframeGeo, wireMat);
  wireframe.renderOrder = 1000; // Render on top
  wireframe.userData.isVoxelWireframe = true; // Mark as voxel wireframe
  group.add(wireframe);

  const key = getVoxelKey(position);
  group.userData = { isVoxel: true, category: category, rotation: rotation, mesh, wireframe, wireMat, originalKey: key };
  // Rotation only applies to models, not the voxel itself
  scene.add(group);
  objects.push(group);

  voxelData.set(key, { voxel: group, model: null, modelUrl: null, category: category, rotation: rotation, customHeight: customHeight });

  // Apply custom height if provided
  if (customHeight && customHeight !== VOXEL_HEIGHT) {
    resizeVoxel(group, customHeight);
  }

  return group;
}

// Change voxel category/color
function setVoxelCategory(voxelGroup, category) {
  const color = CATEGORIES[category].color;
  const key = getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);

  if (data) {
    data.category = category;
    voxelGroup.userData.category = category;

    // Update mesh color
    voxelGroup.userData.mesh.material.color.setHex(color);
    // Update wireframe color
    voxelGroup.userData.wireMat.color.setHex(color);

    saveWorld();
  }
}

// Set model rotation (0, 90, 180, 270 degrees) - only rotates the geometry inside
function setVoxelRotation(voxelGroup, rotation) {
  // Use originalKey for resized voxels
  const key = voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);

  if (data) {
    // Normalize rotation to 0, 90, 180, 270
    rotation = ((rotation % 360) + 360) % 360;
    data.rotation = rotation;
    voxelGroup.userData.rotation = rotation;

    // Only rotate the model, not the voxel
    if (data.model) {
      data.model.rotation.y = (rotation * Math.PI) / 180;
    }

    saveWorld();
  }
}

// Rotate model left (counter-clockwise) by 90 degrees
function rotateModelLeft(voxelGroup) {
  const currentRotation = voxelGroup.userData.rotation || 0;
  const newRotation = (currentRotation - 90 + 360) % 360;
  setVoxelRotation(voxelGroup, newRotation);
  return newRotation;
}

// Rotate model right (clockwise) by 90 degrees
function rotateModelRight(voxelGroup) {
  const currentRotation = voxelGroup.userData.rotation || 0;
  const newRotation = (currentRotation + 90) % 360;
  setVoxelRotation(voxelGroup, newRotation);
  return newRotation;
}

// Fit voxel height to model
function fitVoxelToModel(voxelGroup) {
  // Use stored original key from userData
  const key = voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);

  if (!data || !data.model) {
    showToast('No model to fit', 'error');
    console.log('No model found for key:', key);
    return false;
  }

  // Measure model bounding box in world coordinates
  const box = new THREE.Box3().setFromObject(data.model);
  const modelTop = box.max.y;
  const modelBottom = box.min.y;
  const modelHeight = modelTop - modelBottom;

  console.log('Model bounding box: bottom=' + modelBottom.toFixed(2) + ', top=' + modelTop.toFixed(2) + ', height=' + modelHeight.toFixed(2));

  if (modelHeight <= 0 || !isFinite(modelHeight)) {
    showToast('Could not measure model', 'error');
    return false;
  }

  // Calculate voxel height to wrap the model
  // Voxel should extend from model bottom to model top
  const voxelHeight = modelHeight;

  // Store custom height
  data.customHeight = voxelHeight;

  // Update voxel geometry to match model height
  resizeVoxelToFit(voxelGroup, voxelHeight, modelBottom, key);

  saveWorld();
  console.log('Voxel fitted to model: height=' + voxelHeight.toFixed(2));
  return true;
}

// Unfit voxel - reset to default height and push up voxels above
function unfitVoxel(voxelGroup) {
  const key = voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);

  if (!data) {
    showToast('Voxel not found', 'error');
    return false;
  }

  const currentHeight = voxelGroup.userData.customHeight || VOXEL_HEIGHT;

  // If already at default height, nothing to do
  if (currentHeight === VOXEL_HEIGHT) {
    showToast('Voxel already at default height', 'info');
    return false;
  }

  const heightDifference = VOXEL_HEIGHT - currentHeight;
  const currentBottom = voxelGroup.position.y - currentHeight / 2;
  const currentTop = voxelGroup.position.y + currentHeight / 2;

  // Find all voxels that are above this one (their bottom is at or above our top)
  const voxelsToMove = [];
  voxelData.forEach((otherData, otherKey) => {
    if (otherKey === key) return; // Skip self

    const otherVoxel = otherData.voxel;
    const otherHeight = otherVoxel.userData.customHeight || VOXEL_HEIGHT;
    const otherBottom = otherVoxel.position.y - otherHeight / 2;

    // Check if this voxel is above the current one (with small tolerance)
    if (otherBottom >= currentTop - 0.1) {
      // Check if it's in the same X/Z column
      if (Math.abs(otherVoxel.position.x - voxelGroup.position.x) < 0.1 &&
          Math.abs(otherVoxel.position.z - voxelGroup.position.z) < 0.1) {
        voxelsToMove.push({ voxel: otherVoxel, data: otherData, key: otherKey });
      }
    }
  });

  // Sort voxels by height (bottom first) to move them in order
  voxelsToMove.sort((a, b) => a.voxel.position.y - b.voxel.position.y);

  // Move all voxels above up by the height difference
  voxelsToMove.forEach(({ voxel, data: vData, key: vKey }) => {
    voxel.position.y += heightDifference;

    // Also move the model if present
    if (vData.model) {
      vData.model.position.y += heightDifference;
    }

    // Update the key in voxelData since position changed
    const newKey = getVoxelKey(voxel.position);
    if (newKey !== vKey && !voxel.userData.originalKey) {
      voxel.userData.originalKey = vKey;
    }
  });

  // Reset this voxel to default height
  data.customHeight = null;
  resizeVoxel(voxelGroup, VOXEL_HEIGHT, key);

  saveWorld();
  console.log('Voxel reset to default height, moved', voxelsToMove.length, 'voxels above');
  return true;
}

// Resize voxel to fit model bounds (used by fitVoxelToModel)
function resizeVoxelToFit(voxelGroup, height, modelBottom, existingKey = null) {
  const key = existingKey || voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (!data) {
    console.log('No voxel data found for key:', key);
    return;
  }

  // Store original key for future lookups
  if (!voxelGroup.userData.originalKey) {
    voxelGroup.userData.originalKey = key;
  }

  // Remove old mesh and wireframe
  const oldMesh = voxelGroup.userData.mesh;
  const oldWireframe = voxelGroup.userData.wireframe;
  if (oldMesh) voxelGroup.remove(oldMesh);
  if (oldWireframe) voxelGroup.remove(oldWireframe);

  // Create new geometry with custom height
  const newVoxelGeo = new THREE.BoxGeometry(VOXEL_WIDTH, height, VOXEL_DEPTH);
  const newWireframeGeo = new THREE.EdgesGeometry(newVoxelGeo);

  // Create new mesh with same material settings
  const color = CATEGORIES[data.category || 'none'].color;
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  const mesh = new THREE.Mesh(newVoxelGeo, material);
  mesh.renderOrder = 999;

  // Create new wireframe
  const wireMat = new THREE.LineBasicMaterial({ color: color, transparent: false, linewidth: 2 });
  const wireframe = new THREE.LineSegments(newWireframeGeo, wireMat);
  wireframe.renderOrder = 1000;
  wireframe.userData.isVoxelWireframe = true;

  // Add to group
  voxelGroup.add(mesh);
  voxelGroup.add(wireframe);

  // Update userData
  voxelGroup.userData.mesh = mesh;
  voxelGroup.userData.wireframe = wireframe;
  voxelGroup.userData.wireMat = wireMat;
  voxelGroup.userData.customHeight = height;

  // Position voxel so its bottom aligns with model bottom
  // Voxel center Y = modelBottom + height/2
  voxelGroup.position.y = modelBottom + height / 2;

  console.log('Voxel repositioned: center Y=' + voxelGroup.position.y.toFixed(2));
}

// Resize voxel to custom height
function resizeVoxel(voxelGroup, height, existingKey = null) {
  const key = existingKey || voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (!data) {
    console.log('No voxel data found for key:', key);
    return;
  }

  // Store original key for future lookups
  if (!voxelGroup.userData.originalKey) {
    voxelGroup.userData.originalKey = key;
  }

  // Calculate original bottom position before any changes
  const currentHeight = voxelGroup.userData.customHeight || VOXEL_HEIGHT;
  const originalBottom = voxelGroup.position.y - currentHeight / 2;

  // Remove old mesh and wireframe
  const oldMesh = voxelGroup.userData.mesh;
  const oldWireframe = voxelGroup.userData.wireframe;
  if (oldMesh) voxelGroup.remove(oldMesh);
  if (oldWireframe) voxelGroup.remove(oldWireframe);

  // Create new geometry with custom height
  const newVoxelGeo = new THREE.BoxGeometry(VOXEL_WIDTH, height, VOXEL_DEPTH);
  const newWireframeGeo = new THREE.EdgesGeometry(newVoxelGeo);

  // Create new mesh with same material settings
  const color = CATEGORIES[data.category || 'none'].color;
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  const mesh = new THREE.Mesh(newVoxelGeo, material);
  mesh.renderOrder = 999; // Render after geometry

  // Create new wireframe
  const wireMat = new THREE.LineBasicMaterial({ color: color, transparent: false, linewidth: 2 });
  const wireframe = new THREE.LineSegments(newWireframeGeo, wireMat);
  wireframe.renderOrder = 1000; // Render on top
  wireframe.userData.isVoxelWireframe = true; // Mark as voxel wireframe

  // Add to group
  voxelGroup.add(mesh);
  voxelGroup.add(wireframe);

  // Update userData
  voxelGroup.userData.mesh = mesh;
  voxelGroup.userData.wireframe = wireframe;
  voxelGroup.userData.wireMat = wireMat;
  voxelGroup.userData.customHeight = height;

  // Update voxel position so bottom stays at same place
  voxelGroup.position.y = originalBottom + height / 2;

  console.log('Voxel resized - new position Y:', voxelGroup.position.y, 'height:', height);
}

// Remove voxel
function removeVoxel(voxelGroup) {
  // Use originalKey for resized voxels
  const key = voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (data) {
    if (data.model) {
      scene.remove(data.model);
      data.model = null;
    }
    voxelData.delete(key);
  }
  scene.remove(voxelGroup);
  const idx = objects.indexOf(voxelGroup);
  if (idx > -1) objects.splice(idx, 1);
}

// Get parent voxel group from intersected child
function getVoxelGroup(object) {
  if (object.userData?.isVoxel) return object;
  if (object.parent?.userData?.isVoxel) return object.parent;
  return null;
}

// Toggle category visibility
function toggleCategory(category) {
  categoryVisible[category] = !categoryVisible[category];
  updateVoxelVisibility();
  return categoryVisible[category];
}

// Toggle all voxels on/off
function toggleAllVoxels() {
  voxelsVisible = !voxelsVisible;
  updateVoxelVisibility();
  faceHighlight.visible = false;
  ghostMesh.visible = false;
  return voxelsVisible;
}

// Update voxel and model visibility based on category and global visibility
function updateVoxelVisibility() {
  voxelData.forEach((data) => {
    const cat = data.category || 'none';
    const categoryOn = categoryVisible[cat];

    // Voxels: hidden if category is off OR if global voxels are off
    data.voxel.visible = voxelsVisible && categoryOn;

    // Models: hidden only if category is off (not affected by global voxels toggle)
    if (data.model) {
      data.model.visible = categoryOn;
    }
  });
}

// Place model INSIDE the voxel
async function placeModel(voxelGroup, url) {
  // Use originalKey if available (for resized voxels)
  const key = voxelGroup.userData.originalKey || getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (!data) {
    console.log('placeModel: No data found for key:', key);
    return false;
  }

  // Remove existing model
  if (data.model) {
    scene.remove(data.model);
    data.model = null;
  }

  try {
    const ext = url.split('.').pop().toLowerCase();
    const loader = (ext === 'glb' || ext === 'gltf') ? gltfLoader : objLoader;

    return new Promise((resolve) => {
      loader.load(url, (result) => {
        console.log('Model loaded:', result);
        const model = result.scene || result;

        // Ensure model has materials visible
        model.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }

            if (!child.material) {
              child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
            }

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              if (mat) {
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.opacity = 1;
                mat.depthTest = true;
                mat.depthWrite = true;

                if ("metalness" in mat) mat.metalness = 0;
                if ("roughness" in mat) mat.roughness = 1;
                if ("emissive" in mat) {
                  mat.emissive.setHex(0x111111);
                  mat.emissiveIntensity = 0.4;
                }
                mat.needsUpdate = true;
              }
            });

            child.renderOrder = 1;
          }
        });

        // Keep original scale, but center within voxel bounds
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        console.log('Model size:', size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2), 'meters');

        // Center the model horizontally within voxel (X and Z), keep original Y
        model.position.x = -center.x;
        model.position.z = -center.z;
        // Keep original Y position

        console.log('Model centered within voxel at original scale');

        // Get voxel height for container positioning
        const currentHeight = voxelGroup.userData.customHeight || VOXEL_HEIGHT;

        // Each voxel has its own local origin at bottom center
        const container = new THREE.Group();

        // Calculate bottom of voxel
        const voxelBottom = voxelGroup.position.y - currentHeight / 2;

        // Position container at voxel's bottom center
        container.position.set(
          voxelGroup.position.x,
          voxelBottom,
          voxelGroup.position.z
        );

        container.add(model);

        // Apply voxel rotation to model
        const rotation = data.rotation || 0;
        container.rotation.y = (rotation * Math.PI) / 180;

        scene.add(container);
        data.model = container;
        data.modelUrl = url;

        console.log('Model placed at voxel bottom center:', container.position, 'rotation:', rotation);

        // Apply current render mode to new model
        if (currentRenderMode !== 'normal') {
          setRenderMode(currentRenderMode);
        }

        // Apply section plane if enabled
        if (sectionEnabled) {
          updateSectionPlane();
        }

        saveWorld();
        resolve(true);
      },
      (progress) => {
        console.log('Loading progress:', progress);
      },
      (error) => {
        console.error('Model load error:', error);
        resolve(false);
      });
    });
  } catch (err) {
    console.error('Failed to load model:', err);
    return false;
  }
}

// Remove model from voxel
function removeModel(voxelGroup) {
  const key = getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (data && data.model) {
    scene.remove(data.model);
    data.model = null;
    data.modelUrl = null;
    saveWorld();
    return true;
  }
  return false;
}

// Save/Load - uses Vercel API for persistence
let saveTimeout = null;

function saveWorld() {
  // Debounce saves to avoid too many API calls
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const worldData = [];
    voxelData.forEach((data, key) => {
      const [x, y, z] = key.split(',').map(Number);
      worldData.push({
        x, y, z,
        category: data.category || 'none',
        rotation: data.rotation || 0,
        customHeight: data.customHeight || null,
        modelUrl: data.modelUrl
      });
    });

    try {
      await fetch('/api/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voxels: worldData })
      });
      console.log('World saved to cloud');
    } catch (err) {
      console.error('Failed to save world:', err);
      // Fallback to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(worldData));
    }
  }, 1000);
}

async function loadWorld() {
  try {
    // Try loading from API first
    const res = await fetch('/api/world');
    const data = await res.json();

    if (data.voxels && data.voxels.length > 0) {
      console.log('Loading world from cloud:', data.voxels.length, 'voxels');
      for (const item of data.voxels) {
        const pos = new THREE.Vector3(item.x, item.y, item.z);
        const category = item.category || 'none';
        const rotation = item.rotation || 0;
        const customHeight = item.customHeight || null;
        const voxel = createVoxel(pos, category, rotation, customHeight);
        if (item.modelUrl) {
          await placeModel(voxel, item.modelUrl);
        }
      }
      return;
    }
  } catch (err) {
    console.log('Cloud load failed, trying localStorage:', err);
  }

  // Fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const worldData = JSON.parse(stored);
    for (const item of worldData) {
      const pos = new THREE.Vector3(item.x, item.y, item.z);
      const category = item.category || 'none';
      const rotation = item.rotation || 0;
      const customHeight = item.customHeight || null;
      const voxel = createVoxel(pos, category, rotation, customHeight);
      if (item.modelUrl) {
        await placeModel(voxel, item.modelUrl);
      }
    }
  } catch (e) {
    console.error("Load error:", e);
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Update category button selection state in context menu
function updateCategoryButtonSelection() {
  if (!selectedVoxel) return;
  const currentCat = selectedVoxel.userData.category || 'none';
  categoryBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === currentCat);
  });
}

// Update rotation display in context menu
function updateRotationDisplay() {
  if (!selectedVoxel) return;
  const currentRotation = selectedVoxel.userData.rotation || 0;
  rotationDisplay.textContent = `${currentRotation}°`;
}

// Context menu
function showContextMenu(x, y, voxelGroup) {
  selectedVoxel = voxelGroup;
  const pos = voxelGroup.position;
  const cat = voxelGroup.userData.category || 'none';
  cellInfoEl.textContent = `${CATEGORIES[cat].name} (${Math.round(pos.x/VOXEL_WIDTH)}, ${Math.round(pos.y/VOXEL_HEIGHT)}, ${Math.round(pos.z/VOXEL_DEPTH)})`;

  // Use originalKey for resized voxels
  const key = voxelGroup.userData.originalKey || getVoxelKey(pos);
  const data = voxelData.get(key);
  const hasModel = data && data.modelUrl;
  fitToModelBtn.style.display = hasModel ? 'flex' : 'none';

  // Show unfit button only if voxel has custom height
  const hasCustomHeight = data && data.customHeight && data.customHeight !== VOXEL_HEIGHT;
  unfitVoxelBtn.style.display = hasCustomHeight ? 'flex' : 'none';

  // Update category button selection
  updateCategoryButtonSelection();

  // Update rotation display
  updateRotationDisplay();

  // Show menu first to get its dimensions
  contextMenu.classList.add('active');

  // Keep menu within viewport bounds
  const menuRect = contextMenu.getBoundingClientRect();
  const padding = 10;

  let menuX = x;
  let menuY = y;

  // Check right edge
  if (x + menuRect.width > window.innerWidth - padding) {
    menuX = window.innerWidth - menuRect.width - padding;
  }

  // Check bottom edge
  if (y + menuRect.height > window.innerHeight - padding) {
    menuY = window.innerHeight - menuRect.height - padding;
  }

  // Check left edge
  if (menuX < padding) {
    menuX = padding;
  }

  // Check top edge
  if (menuY < padding) {
    menuY = padding;
  }

  contextMenu.style.left = menuX + 'px';
  contextMenu.style.top = menuY + 'px';

  // Highlight voxel
  if (voxelGroup.userData.mesh) {
    voxelGroup.userData.mesh.material.opacity = 0.5;
  }
}

function hideContextMenu() {
  if (selectedVoxel && selectedVoxel.userData.mesh) {
    selectedVoxel.userData.mesh.material.opacity = 0.08;
  }
  selectedVoxel = null;
  contextMenu.classList.remove('active');
}

// Pointer events
let pendingVoxelPos = null;  // Store position for voxel placement

function onPointerMove(e) {
  // Update pointer position for raycasting
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  // Don't show hover highlight when voxels are hidden
  if (!voxelsVisible) {
    hoverBox.visible = false;
    hoveredVoxel = null;
    canvas.style.cursor = 'default';
    faceHighlight.visible = false;
    ghostMesh.visible = false;
    pendingVoxelPos = null;
    return;
  }

  // Check for hover on voxels (for hover highlight)
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  // Find hovered voxel
  let newHoveredVoxel = null;
  for (const intersect of intersects) {
    const voxelGroup = getVoxelGroup(intersect.object);
    if (voxelGroup) {
      newHoveredVoxel = voxelGroup;
      break;
    }
  }

  // Update hover highlight
  if (newHoveredVoxel !== hoveredVoxel) {
    hoveredVoxel = newHoveredVoxel;
    if (hoveredVoxel) {
      // Get voxel dimensions
      const voxelHeight = hoveredVoxel.userData.customHeight || VOXEL_HEIGHT;
      // Scale and position hover box to match voxel
      hoverBox.scale.set(VOXEL_WIDTH, voxelHeight, VOXEL_DEPTH);
      hoverBox.position.copy(hoveredVoxel.position);
      hoverBox.visible = true;
      canvas.style.cursor = 'pointer';
    } else {
      hoverBox.visible = false;
      canvas.style.cursor = 'default';
    }
  }

  // Only show placement highlight when Control key is held and voxels are visible
  if (!voxelsVisible || !e.ctrlKey) {
    faceHighlight.visible = false;
    ghostMesh.visible = false;
    pendingVoxelPos = null;
    return;
  }

  // Use already calculated intersects for placement preview
  if (intersects.length > 0) {
    const intersect = intersects[0];

    // Skip if no face data (e.g., lines, points)
    if (!intersect.face) {
      faceHighlight.visible = false;
      ghostMesh.visible = false;
      pendingVoxelPos = null;
      return;
    }

    const normal = intersect.face.normal.clone();
    const voxelGroup = getVoxelGroup(intersect.object);

    let facePos, newVoxelPos;

    if (voxelGroup) {
      // Hovering over existing voxel - get the face position
      // Transform normal to world space
      normal.transformDirection(intersect.object.matrixWorld);
      normal.round();  // Normalize to axis-aligned

      // Get the actual height of this voxel (may be custom)
      const voxelHeight = voxelGroup.userData.customHeight || VOXEL_HEIGHT;
      const halfVoxelHeight = voxelHeight / 2;

      // Calculate offset based on normal direction (use actual voxel height for Y)
      const halfOffset = new THREE.Vector3(
        normal.x * HALF_WIDTH,
        normal.y * halfVoxelHeight,
        normal.z * HALF_DEPTH
      );

      // Face center is on the surface of the voxel
      facePos = voxelGroup.position.clone().add(halfOffset);

      // For new voxel placement: X and Z use standard size, Y depends on face
      if (Math.abs(normal.y) > 0.5) {
        // Top or bottom face - place new voxel with default height
        // Calculate position based on actual voxel bounds
        const voxelTop = voxelGroup.position.y + halfVoxelHeight;
        const voxelBottom = voxelGroup.position.y - halfVoxelHeight;

        if (normal.y > 0) {
          // Top face - new voxel sits on top
          newVoxelPos = new THREE.Vector3(
            voxelGroup.position.x,
            voxelTop + HALF_HEIGHT,  // New voxel center is half default height above top
            voxelGroup.position.z
          );
        } else {
          // Bottom face - new voxel goes below
          newVoxelPos = new THREE.Vector3(
            voxelGroup.position.x,
            voxelBottom - HALF_HEIGHT,  // New voxel center is half default height below bottom
            voxelGroup.position.z
          );
        }
      } else {
        // Side face - horizontal offset, keep same base height as original voxel
        // Calculate the bottom of the original voxel and place new voxel at same base
        const voxelBottom = voxelGroup.position.y - halfVoxelHeight;
        newVoxelPos = new THREE.Vector3(
          voxelGroup.position.x + normal.x * VOXEL_WIDTH,
          voxelBottom + HALF_HEIGHT,  // New voxel's bottom aligns with original voxel's bottom
          voxelGroup.position.z + normal.z * VOXEL_DEPTH
        );
      }

      // Update face highlight geometry based on face orientation
      updateFaceHighlightGeometry(normal);
    } else {
      // Hovering over ground plane
      facePos = intersect.point.clone();
      facePos.y = 0;  // On ground level
      normal.set(0, 1, 0);  // Ground normal is up

      // Snap to grid and place above ground
      newVoxelPos = snapToGrid(intersect.point.clone());
      newVoxelPos.y = HALF_HEIGHT;  // First level

      updateFaceHighlightGeometry(normal);
    }

    // Check bounds (6x6x3 grid)
    const halfGridX = GRID_SIZE_X / 2;
    const halfGridZ = GRID_SIZE_Z / 2;
    const inBounds = (
      newVoxelPos.x >= -halfGridX + HALF_WIDTH &&
      newVoxelPos.x <= halfGridX - HALF_WIDTH &&
      newVoxelPos.z >= -halfGridZ + HALF_DEPTH &&
      newVoxelPos.z <= halfGridZ - HALF_DEPTH &&
      newVoxelPos.y >= HALF_HEIGHT &&
      newVoxelPos.y <= (MAX_HEIGHT_LEVELS - 0.5) * VOXEL_HEIGHT + HALF_HEIGHT
    );

    // Check if position is already occupied
    const key = getVoxelKey(newVoxelPos);
    const occupied = voxelData.has(key);

    if (inBounds && !occupied) {
      // Position face highlight on the surface
      faceHighlight.position.copy(facePos);
      faceHighlight.lookAt(facePos.clone().add(normal));
      faceHighlight.visible = true;

      // Position ghost voxel where new voxel will be placed
      ghostMesh.position.copy(newVoxelPos);
      ghostMesh.visible = true;

      pendingVoxelPos = newVoxelPos.clone();
      setHighlightColor(0x00ff88);
      canvas.style.cursor = 'crosshair';
    } else {
      faceHighlight.visible = false;
      ghostMesh.visible = false;
      pendingVoxelPos = null;
      canvas.style.cursor = 'not-allowed';
    }
  } else {
    faceHighlight.visible = false;
    ghostMesh.visible = false;
    pendingVoxelPos = null;
    canvas.style.cursor = 'default';
  }
}

function onPointerDown(e) {
  // Hide context menu on any click
  if (contextMenu.classList.contains('active')) {
    hideContextMenu();
    return;
  }

  // Only place voxels with Ctrl+Click (left button)
  if (!voxelsVisible || e.button !== 0 || !e.ctrlKey) return;

  // Use the pre-calculated position from onPointerMove
  if (pendingVoxelPos) {
    const key = getVoxelKey(pendingVoxelPos);
    if (!voxelData.has(key)) {
      createVoxel(pendingVoxelPos.clone(), 'none');
      saveWorld();
      // Trigger pointer move to update highlight
      onPointerMove(e);
    }
  }
}

function onContextMenu(e) {
  e.preventDefault();

  // On Mac, Ctrl+Click triggers contextmenu - ignore it since Ctrl+Click is for placing voxels
  if (e.ctrlKey) return;

  if (!voxelsVisible) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  if (intersects.length > 0) {
    const voxelGroup = getVoxelGroup(intersects[0].object);
    if (voxelGroup) {
      showContextMenu(e.clientX, e.clientY, voxelGroup);
    }
  }
}

// File upload - uses Vercel Blob storage
async function handleUpload(file) {
  // Use voxelForUpload which was stored when upload button was clicked
  const targetVoxel = voxelForUpload;
  voxelForUpload = null;  // Clear after use

  if (!targetVoxel) {
    console.error('No voxel selected for upload');
    showToast('Please right-click a voxel first', 'error');
    return;
  }

  // Check file size (max 4.5MB on Vercel free tier, 10MB on Pro)
  const maxSize = 4.5 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File too large (max 4.5MB). Compress your GLB!', 'error');
    return;
  }

  console.log('Starting upload for voxel:', targetVoxel.position);
  showToast('Uploading...', 'loading');

  try {
    // Upload to server
    const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });
    const json = await res.json();
    console.log('Upload response:', json);

    if (res.ok) {
      showToast('Placing model...', 'loading');
      const success = await placeModel(targetVoxel, json.file.url);
      if (success) {
        showToast('Model placed!', 'success');
      } else {
        showToast('Failed to place model', 'error');
      }
    } else {
      showToast('Error: ' + json.error, 'error');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed', 'error');
  }

  hideContextMenu();
}

// Initialize post-processing composer for outline mode
// Set render mode
function setRenderMode(mode) {
  const prevMode = currentRenderMode;
  currentRenderMode = mode;

  // Reset to normal first
  resetRenderMode();

  switch(mode) {
    case 'normal':
      // Already reset
      break;
    case 'shadow':
      applyShadowMode();
      break;
    case 'wireframe':
      applyWireframeMode();
      break;
  }

  showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`, 'success');
}

// Reset to normal mode
function resetRenderMode() {
  shadowGround.visible = false;

  // Remove edge lines (stored as arrays per voxel key)
  edgeLines.forEach((linesArray, key) => {
    if (Array.isArray(linesArray)) {
      linesArray.forEach(line => scene.remove(line));
    } else {
      scene.remove(linesArray);
    }
  });
  edgeLines.clear();


  // Clean up any stray objects that might have been left behind
  const toRemove = [];
  scene.traverse((obj) => {
    // Clean up orphan line segments
    if ((obj.isLineSegments || obj.isLineSegments2 || obj.isLine2) &&
        !obj.userData.isHelper &&
        !obj.userData.isVoxelWireframe) {
      let isOrphan = true;
      voxelData.forEach((data) => {
        if (data.voxel && data.voxel.children.includes(obj)) {
          isOrphan = false;
        }
      });
      if (isOrphan) {
        toRemove.push(obj);
      }
    }
  });
  toRemove.forEach(obj => scene.remove(obj));

  // Restore original materials and settings
  voxelData.forEach((data, key) => {
    // Restore voxel visibility
    if (data.voxel) {
      data.voxel.userData.mesh.visible = true;
    }

    if (data.model) {
      data.model.traverse((child) => {
        if (child.isMesh) {
          // Restore visibility
          child.visible = true;
          // Restore original material
          const originalMat = savedMaterials.get(child.uuid);
          if (originalMat) {
            child.material = originalMat;
          }
          // Reset shadow settings
          child.castShadow = false;
          child.receiveShadow = false;
          // Clear clipping planes
          if (child.material && child.material.clippingPlanes) {
            child.material.clippingPlanes = null;
          }
        }
      });
    }
  });

  // Reset light colors to default white
  ambientLight.color.setHex(0xffffff);
  dirLight.color.setHex(0xffffff);
  hemiLight.color.setHex(0xffffff);
  hemiLight.groundColor.setHex(0x444444);

  // Reset lighting
  ambientLight.intensity = 1.5;
  dirLight.intensity = 2;
  hemiLight.intensity = 1;
}

// Apply Shadow Mode
function applyShadowMode() {
  shadowGround.visible = true;

  const uniformMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  voxelData.forEach((data, key) => {
    if (data.model) {
      data.model.traverse((child) => {
        if (child.isMesh) {
          if (!savedMaterials.has(child.uuid)) {
            savedMaterials.set(child.uuid, child.material);
          }
          child.material = uniformMaterial.clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  });

  ambientLight.intensity = 0.6;
  dirLight.intensity = 1.5;
  hemiLight.intensity = 0.5;
}

// Apply Wireframe Mode
function applyWireframeMode() {
  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333,
    wireframe: true
  });

  voxelData.forEach((data, key) => {
    // Hide voxel mesh, keep wireframe
    if (data.voxel) {
      data.voxel.userData.mesh.visible = false;
    }

    if (data.model) {
      data.model.traverse((child) => {
        if (child.isMesh) {
          if (!savedMaterials.has(child.uuid)) {
            savedMaterials.set(child.uuid, child.material);
          }
          child.material = wireframeMaterial.clone();
        }
      });
    }
  });

  ambientLight.intensity = 2;
}

// Section Plane functions
function updateSectionPlane() {
  if (!sectionEnabled) {
    // Disable clipping on all materials
    voxelData.forEach((data) => {
      if (data.model) {
        data.model.traverse((child) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.clippingPlanes = null;
              mat.needsUpdate = true;
            });
          }
        });
      }
      if (data.voxel && data.voxel.userData.mesh) {
        data.voxel.userData.mesh.material.clippingPlanes = null;
        data.voxel.userData.mesh.material.needsUpdate = true;
      }
    });
    return;
  }

  // Calculate plane position based on axis and slider
  let normal = new THREE.Vector3();
  let constant = 0;

  // Grid bounds
  const minX = -GRID_SIZE_X / 2;
  const maxX = GRID_SIZE_X / 2;
  const minY = 0;
  const maxY = MAX_HEIGHT_LEVELS * VOXEL_HEIGHT;
  const minZ = -GRID_SIZE_Z / 2;
  const maxZ = GRID_SIZE_Z / 2;

  const t = sectionPosition; // 0 to 1

  switch(sectionAxis) {
    case 'x':
      normal.set(sectionFlipped ? 1 : -1, 0, 0);
      constant = (sectionFlipped ? -1 : 1) * (minX + t * (maxX - minX));
      break;
    case 'y':
      normal.set(0, sectionFlipped ? 1 : -1, 0);
      constant = (sectionFlipped ? -1 : 1) * (minY + t * (maxY - minY));
      break;
    case 'z':
      normal.set(0, 0, sectionFlipped ? 1 : -1);
      constant = (sectionFlipped ? -1 : 1) * (minZ + t * (maxZ - minZ));
      break;
  }

  sectionPlane.set(normal, constant);

  // Apply clipping to all meshes
  voxelData.forEach((data) => {
    if (data.model) {
      data.model.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            mat.clippingPlanes = [sectionPlane];
            mat.clipShadows = true;
            mat.needsUpdate = true;
          });
        }
      });
    }
    if (data.voxel && data.voxel.userData.mesh) {
      data.voxel.userData.mesh.material.clippingPlanes = [sectionPlane];
      data.voxel.userData.mesh.material.needsUpdate = true;
    }
  });
}

// Event listeners
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('contextmenu', onContextMenu);

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target) && contextMenu.classList.contains('active')) {
    hideContextMenu();
  }
});

uploadBtn.addEventListener('click', () => {
  // Store the voxel reference BEFORE opening file dialog
  // because context menu will close and clear selectedVoxel
  voxelForUpload = selectedVoxel;
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleUpload(e.target.files[0]);
    fileInput.value = '';
  }
});

fitToModelBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    if (fitVoxelToModel(selectedVoxel)) {
      showToast('Voxel fitted to model', 'success');
    }
    hideContextMenu();
  }
});

unfitVoxelBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    if (unfitVoxel(selectedVoxel)) {
      showToast('Voxel height reset', 'success');
    }
    hideContextMenu();
  }
});

deleteVoxelBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    removeVoxel(selectedVoxel);
    saveWorld();
    showToast('Voxel deleted', 'success');
    hideContextMenu();
  }
});

// Toggle all voxels button
toggleAllBtn.addEventListener('click', () => {
  const visible = toggleAllVoxels();
  toggleAllBtn.textContent = visible ? 'Hide All Voxels' : 'Show All Voxels';
  toggleAllBtn.classList.toggle('hidden', !visible);
});

// Render mode select
renderModeSelect.addEventListener('change', (e) => {
  setRenderMode(e.target.value);
});

// Section plane controls
sectionPlaneEnabled.addEventListener('change', (e) => {
  sectionEnabled = e.target.checked;
  sectionControls.style.display = sectionEnabled ? 'block' : 'none';
  updateSectionPlane();
});

sectionSlider.addEventListener('input', (e) => {
  sectionPosition = e.target.value / 100;
  sectionValue.textContent = e.target.value;
  updateSectionPlane();
});

sectionFlip.addEventListener('change', (e) => {
  sectionFlipped = e.target.checked;
  updateSectionPlane();
});

axisBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    axisBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sectionAxis = btn.dataset.axis;
    updateSectionPlane();
  });
});

// Category filter checkboxes
filterCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener('change', (e) => {
    const category = e.target.closest('.filter-item').dataset.category;
    categoryVisible[category] = e.target.checked;
    updateVoxelVisibility();
  });
});

// Category buttons in context menu
categoryBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (selectedVoxel) {
      const category = btn.dataset.category;
      setVoxelCategory(selectedVoxel, category);
      updateCategoryButtonSelection();
      showToast(`Category: ${CATEGORIES[category].name}`, 'success');
    }
  });
});

// Rotation buttons in context menu
rotateLeftBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    const newRotation = rotateModelLeft(selectedVoxel);
    updateRotationDisplay();
    showToast(`Rotation: ${newRotation}°`, 'success');
  }
});

rotateRightBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    const newRotation = rotateModelRight(selectedVoxel);
    updateRotationDisplay();
    showToast(`Rotation: ${newRotation}°`, 'success');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// SOLAR IRRADIATION ANALYSIS
// ============================================

// Store original materials to restore later
const originalMaterials = new Map();
let analysisActive = false;

// Sun path visualization
let sunPathGroup = null;
const SUN_PATH_RADIUS = 80; // Distance from center for sun path visualization

// Create sun path visualization
function createSunPath() {
  // Remove existing sun path
  if (sunPathGroup) {
    scene.remove(sunPathGroup);
    sunPathGroup = null;
  }

  const [lat, lng] = locationSelect.value.split(',').map(Number);
  const period = periodSelect.value;
  const year = new Date().getFullYear();

  sunPathGroup = new THREE.Group();
  sunPathGroup.name = 'sunPath';

  // Get dates based on period
  let dates = [];
  let colors = [];

  switch (period) {
    case 'summer':
      dates = [new Date(year, 5, 21)];
      colors = [0xffaa00]; // Orange for summer
      break;
    case 'winter':
      dates = [new Date(year, 11, 21)];
      colors = [0x00aaff]; // Blue for winter
      break;
    case 'equinox':
      dates = [new Date(year, 2, 21)];
      colors = [0x00ff88]; // Green for equinox
      break;
    case 'year':
      // Show summer, equinox, and winter paths
      dates = [
        new Date(year, 5, 21),  // Summer
        new Date(year, 2, 21),  // Spring equinox
        new Date(year, 11, 21)  // Winter
      ];
      colors = [0xffaa00, 0x00ff88, 0x00aaff];
      break;
  }

  // Create path for each date
  dates.forEach((baseDate, dateIndex) => {
    const pathPoints = [];
    const sunPositions = [];

    // Sample every 30 minutes from 5am to 9pm
    for (let hour = 5; hour <= 21; hour += 0.5) {
      const date = new Date(baseDate);
      date.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);

      const sunPos = SunCalc.getPosition(date, lat, lng);

      // Only include if sun is above horizon
      if (sunPos.altitude > 0) {
        // Convert sun position to 3D coordinates
        // Azimuth: 0 = South, positive = West (SunCalc convention)
        // We rotate so North is +Z in Three.js
        const azimuth = sunPos.azimuth + Math.PI; // Rotate 180° so South faces -Z
        const altitude = sunPos.altitude;

        const x = Math.sin(azimuth) * Math.cos(altitude) * SUN_PATH_RADIUS;
        const y = Math.sin(altitude) * SUN_PATH_RADIUS;
        const z = Math.cos(azimuth) * Math.cos(altitude) * SUN_PATH_RADIUS;

        pathPoints.push(new THREE.Vector3(x, y, z));
        sunPositions.push({ hour, x, y, z, altitude });
      }
    }

    if (pathPoints.length > 1) {
      // Create the path line
      const curve = new THREE.CatmullRomCurve3(pathPoints);
      const curvePoints = curve.getPoints(100);
      const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const material = new THREE.LineBasicMaterial({
        color: colors[dateIndex],
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });
      const pathLine = new THREE.Line(geometry, material);
      sunPathGroup.add(pathLine);

      // Add sun position markers every 2 hours
      sunPositions.forEach((pos) => {
        if (pos.hour % 2 === 0 || pos.hour === 12) {
          // Sun sphere
          const sphereGeo = new THREE.SphereGeometry(pos.hour === 12 ? 1.2 : 0.6, 16, 16);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: pos.hour === 12 ? 0xffff00 : colors[dateIndex],
            transparent: true,
            opacity: 0.9
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.set(pos.x, pos.y, pos.z);
          sunPathGroup.add(sphere);

          // Hour label
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.floor(pos.hour)}h`, 32, 22);

          const texture = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
          });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.position.set(pos.x, pos.y + 1.5, pos.z);
          sprite.scale.set(3, 1.5, 1);
          sunPathGroup.add(sprite);
        }
      });
    }
  });

  // Add compass directions
  const directions = [
    { label: 'N', angle: 0, color: 0xff4444 },
    { label: 'E', angle: Math.PI / 2, color: 0xffffff },
    { label: 'S', angle: Math.PI, color: 0xffffff },
    { label: 'W', angle: -Math.PI / 2, color: 0xffffff }
  ];

  directions.forEach((dir) => {
    const x = Math.sin(dir.angle) * (SUN_PATH_RADIUS + 3);
    const z = Math.cos(dir.angle) * (SUN_PATH_RADIUS + 3);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = dir.label === 'N' ? '#ff4444' : '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dir.label, 32, 45);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, 0.5, z);
    sprite.scale.set(4, 4, 1);
    sunPathGroup.add(sprite);
  });

  // Add horizon circle
  const horizonPoints = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    horizonPoints.push(new THREE.Vector3(
      Math.sin(angle) * SUN_PATH_RADIUS,
      0,
      Math.cos(angle) * SUN_PATH_RADIUS
    ));
  }
  const horizonGeo = new THREE.BufferGeometry().setFromPoints(horizonPoints);
  const horizonMat = new THREE.LineBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.5
  });
  const horizonLine = new THREE.Line(horizonGeo, horizonMat);
  sunPathGroup.add(horizonLine);

  scene.add(sunPathGroup);
}

// Toggle sun path visibility
function toggleSunPath(show) {
  if (show) {
    createSunPath();
  } else if (sunPathGroup) {
    scene.remove(sunPathGroup);
    sunPathGroup = null;
  }
}

// Update sun path when settings change
function updateSunPathIfVisible() {
  if (showSunPathCheckbox.checked) {
    createSunPath();
  }
}

// Sun path checkbox listener
showSunPathCheckbox.addEventListener('change', (e) => {
  toggleSunPath(e.target.checked);
});

// Update sun path when location or period changes
locationSelect.addEventListener('change', updateSunPathIfVisible);
periodSelect.addEventListener('change', updateSunPathIfVisible);

// Get sun direction vector from SunCalc position
function getSunDirection(lat, lng, date) {
  const sunPos = SunCalc.getPosition(date, lat, lng);

  // sunPos.altitude is elevation angle (radians from horizon)
  // sunPos.azimuth is azimuth angle (radians from south, westward positive)

  // Skip if sun is below horizon
  if (sunPos.altitude <= 0) return null;

  // Convert to 3D direction vector (sun position in sky)
  // Azimuth: 0 = South, positive = West
  // We need to convert to Three.js coordinates where -Z is typically "forward"
  const azimuth = sunPos.azimuth;
  const altitude = sunPos.altitude;

  // Direction FROM the sun TO the surface (for shadow casting)
  const x = -Math.sin(azimuth) * Math.cos(altitude);
  const y = -Math.sin(altitude);
  const z = -Math.cos(azimuth) * Math.cos(altitude);

  return new THREE.Vector3(x, y, z).normalize();
}

// Generate sun positions for analysis period
function generateSunPositions(lat, lng, period) {
  const positions = [];
  const year = new Date().getFullYear();

  let dates = [];

  switch (period) {
    case 'summer':
      // Summer solstice - June 21, hourly from 6am to 8pm
      dates = [new Date(year, 5, 21)]; // June 21
      break;
    case 'winter':
      // Winter solstice - December 21
      dates = [new Date(year, 11, 21)]; // December 21
      break;
    case 'equinox':
      // Spring equinox - March 21
      dates = [new Date(year, 2, 21)]; // March 21
      break;
    case 'year':
      // Sample one day per month
      for (let month = 0; month < 12; month++) {
        dates.push(new Date(year, month, 21));
      }
      break;
  }

  // For each date, sample hourly from 6am to 8pm
  for (const baseDate of dates) {
    for (let hour = 6; hour <= 20; hour++) {
      const date = new Date(baseDate);
      date.setHours(hour, 0, 0, 0);

      const direction = getSunDirection(lat, lng, date);
      if (direction) {
        positions.push({
          date,
          direction,
          // Weight by sun altitude (higher sun = more energy)
          weight: Math.sin(SunCalc.getPosition(date, lat, lng).altitude)
        });
      }
    }
  }

  return positions;
}

// Sample points on a triangle
function sampleTrianglePoints(v0, v1, v2, density) {
  const points = [];
  const steps = density;

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps - i; j++) {
      const u = i / steps;
      const v = j / steps;
      const w = 1 - u - v;

      const point = new THREE.Vector3(
        v0.x * w + v1.x * u + v2.x * v,
        v0.y * w + v1.y * u + v2.y * v,
        v0.z * w + v1.z * u + v2.z * v
      );
      points.push(point);
    }
  }

  return points;
}

// Get all meshes from uploaded models
function getModelMeshes() {
  const meshes = [];

  voxelData.forEach((data) => {
    if (data.model) {
      data.model.traverse((child) => {
        if (child.isMesh && child.geometry) {
          meshes.push(child);
        }
      });
    }
  });

  return meshes;
}

// Get all blocking objects (voxels + models)
function getBlockingObjects() {
  const blockers = [];

  // Add voxel meshes
  voxelData.forEach((data) => {
    if (data.voxel && data.voxel.visible) {
      data.voxel.traverse((child) => {
        if (child.isMesh) {
          blockers.push(child);
        }
      });
    }
    // Add model meshes
    if (data.model && data.model.visible) {
      data.model.traverse((child) => {
        if (child.isMesh) {
          blockers.push(child);
        }
      });
    }
  });

  return blockers;
}

// Color gradient for heatmap (blue -> green -> yellow -> red)
function getHeatmapColor(value) {
  // value is 0-1 representing sun exposure percentage
  const colors = [
    { pos: 0.0, r: 30, g: 58, b: 95 },    // Dark blue (no sun)
    { pos: 0.25, r: 37, g: 99, b: 235 },   // Blue
    { pos: 0.5, r: 34, g: 197, b: 94 },    // Green
    { pos: 0.75, r: 234, g: 179, b: 8 },   // Yellow
    { pos: 1.0, r: 239, g: 68, b: 68 }     // Red (full sun)
  ];

  // Find the two colors to interpolate between
  let lower = colors[0];
  let upper = colors[colors.length - 1];

  for (let i = 0; i < colors.length - 1; i++) {
    if (value >= colors[i].pos && value <= colors[i + 1].pos) {
      lower = colors[i];
      upper = colors[i + 1];
      break;
    }
  }

  // Interpolate
  const range = upper.pos - lower.pos;
  const t = range > 0 ? (value - lower.pos) / range : 0;

  const r = Math.round(lower.r + (upper.r - lower.r) * t);
  const g = Math.round(lower.g + (upper.g - lower.g) * t);
  const b = Math.round(lower.b + (upper.b - lower.b) * t);

  return new THREE.Color(r / 255, g / 255, b / 255);
}

// Main analysis function
async function runSolarAnalysis() {
  const modelMeshes = getModelMeshes();

  if (modelMeshes.length === 0) {
    showToast('No models to analyze. Upload some models first!', 'error');
    return;
  }

  // Get settings
  const [lat, lng] = locationSelect.value.split(',').map(Number);
  const period = periodSelect.value;
  const densityMap = { low: 2, medium: 4, high: 6 };
  const sampleDensity = densityMap[densitySelect.value];

  // Show progress
  analysisActive = true;
  runAnalysisBtn.disabled = true;
  analysisProgress.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Calculating sun positions...';

  // Generate sun positions
  const sunPositions = generateSunPositions(lat, lng, period);
  console.log(`Generated ${sunPositions.length} sun positions for analysis`);

  if (sunPositions.length === 0) {
    showToast('No valid sun positions for this period', 'error');
    resetAnalysisUI();
    return;
  }

  // Get blocking objects
  const blockers = getBlockingObjects();
  const blockRaycaster = new THREE.Raycaster();

  // Store irradiation values per vertex
  const meshIrradiation = new Map();

  let totalTriangles = 0;
  modelMeshes.forEach(mesh => {
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    totalTriangles += geo.index ? geo.index.count / 3 : posAttr.count / 3;
  });

  let processedTriangles = 0;

  progressText.textContent = 'Analyzing surfaces...';

  // Process each mesh
  for (const mesh of modelMeshes) {
    // Store original material
    if (!originalMaterials.has(mesh.uuid)) {
      originalMaterials.set(mesh.uuid, mesh.material.clone());
    }

    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;

    if (!normalAttr) {
      geometry.computeVertexNormals();
    }

    // Get world matrix for transforming positions
    mesh.updateMatrixWorld(true);
    const worldMatrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    // Create vertex colors array
    const vertexCount = positionAttr.count;
    const irradiationValues = new Float32Array(vertexCount).fill(0);
    const hitCounts = new Float32Array(vertexCount).fill(0);

    // Process triangles
    const indices = geometry.index;
    const triangleCount = indices ? indices.count / 3 : vertexCount / 3;

    for (let tri = 0; tri < triangleCount; tri++) {
      // Get vertex indices
      let i0, i1, i2;
      if (indices) {
        i0 = indices.getX(tri * 3);
        i1 = indices.getX(tri * 3 + 1);
        i2 = indices.getX(tri * 3 + 2);
      } else {
        i0 = tri * 3;
        i1 = tri * 3 + 1;
        i2 = tri * 3 + 2;
      }

      // Get world positions
      const v0 = new THREE.Vector3().fromBufferAttribute(positionAttr, i0).applyMatrix4(worldMatrix);
      const v1 = new THREE.Vector3().fromBufferAttribute(positionAttr, i1).applyMatrix4(worldMatrix);
      const v2 = new THREE.Vector3().fromBufferAttribute(positionAttr, i2).applyMatrix4(worldMatrix);

      // Get face normal (average of vertex normals)
      const n0 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i0);
      const n1 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i1);
      const n2 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i2);
      const faceNormal = new THREE.Vector3()
        .addVectors(n0, n1).add(n2).normalize()
        .applyMatrix3(normalMatrix).normalize();

      // Sample points on triangle
      const samplePoints = sampleTrianglePoints(v0, v1, v2, sampleDensity);

      // Accumulate irradiation for this triangle
      let triangleIrradiation = 0;
      let totalWeight = 0;

      for (const sunData of sunPositions) {
        const sunDir = sunData.direction;

        // Check if face is oriented towards sun (dot product > 0)
        const dotProduct = faceNormal.dot(sunDir.clone().negate());
        if (dotProduct <= 0) continue; // Face is away from sun

        // Check shadow for sample points
        let exposedSamples = 0;

        for (const point of samplePoints) {
          // Offset point slightly along normal to avoid self-intersection
          const rayOrigin = point.clone().add(faceNormal.clone().multiplyScalar(0.01));
          const rayDir = sunDir.clone().negate(); // Direction TO sun

          blockRaycaster.set(rayOrigin, rayDir);
          blockRaycaster.far = 1000;

          // Check for intersections with blocking objects
          const intersects = blockRaycaster.intersectObjects(blockers, false);

          // Filter out self-intersections
          const blocked = intersects.some(hit => hit.object !== mesh && hit.distance > 0.02);

          if (!blocked) {
            exposedSamples++;
          }
        }

        // Calculate exposure ratio for this sun position
        const exposure = exposedSamples / samplePoints.length;
        triangleIrradiation += exposure * dotProduct * sunData.weight;
        totalWeight += sunData.weight;
      }

      // Normalize irradiation
      const normalizedIrradiation = totalWeight > 0 ? triangleIrradiation / totalWeight : 0;

      // Add to vertex values
      irradiationValues[i0] += normalizedIrradiation;
      irradiationValues[i1] += normalizedIrradiation;
      irradiationValues[i2] += normalizedIrradiation;
      hitCounts[i0]++;
      hitCounts[i1]++;
      hitCounts[i2]++;

      processedTriangles++;

      // Update progress periodically
      if (processedTriangles % 10 === 0) {
        const progress = Math.round((processedTriangles / totalTriangles) * 100);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Analyzing... ${progress}%`;

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Average vertex values and create colors
    const colors = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      const avgIrradiation = hitCounts[i] > 0 ? irradiationValues[i] / hitCounts[i] : 0;
      const color = getHeatmapColor(avgIrradiation);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    // Apply vertex colors
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Update material to use vertex colors
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });
  }

  // Complete
  progressFill.style.width = '100%';
  progressText.textContent = 'Analysis complete!';
  colorLegend.style.display = 'block';
  clearAnalysisBtn.style.display = 'block';
  runAnalysisBtn.disabled = false;

  setTimeout(() => {
    analysisProgress.style.display = 'none';
  }, 1500);

  showToast('Solar analysis complete!', 'success');
}

// Clear heatmap and restore original materials
function clearAnalysis() {
  const modelMeshes = getModelMeshes();

  for (const mesh of modelMeshes) {
    const originalMat = originalMaterials.get(mesh.uuid);
    if (originalMat) {
      mesh.material = originalMat;
    }
    // Remove vertex colors
    if (mesh.geometry.attributes.color) {
      mesh.geometry.deleteAttribute('color');
    }
  }

  originalMaterials.clear();
  analysisActive = false;
  colorLegend.style.display = 'none';
  clearAnalysisBtn.style.display = 'none';

  showToast('Heatmap cleared', 'success');
}

function resetAnalysisUI() {
  analysisActive = false;
  runAnalysisBtn.disabled = false;
  analysisProgress.style.display = 'none';
}

// Solar panel toggle
// Initialize solar panel as collapsed
const solarContent = solarPanel.querySelector('.solar-content');
solarContent.classList.add('collapsed');
toggleSolarPanelBtn.textContent = '+';

toggleSolarPanelBtn.addEventListener('click', () => {
  solarContent.classList.toggle('collapsed');
  toggleSolarPanelBtn.textContent = solarContent.classList.contains('collapsed') ? '+' : '-';
});

// Run analysis button
runAnalysisBtn.addEventListener('click', () => {
  runSolarAnalysis();
});

// Clear analysis button
clearAnalysisBtn.addEventListener('click', () => {
  clearAnalysis();
});

// Animation
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Start
loadWorld().then(() => {
  console.log("World loaded, starting animation...");
  animate();
});
