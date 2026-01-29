import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

console.log("Voxel Builder starting...");

// DOM Elements
const canvas = document.getElementById("sceneCanvas");
const contextMenu = document.getElementById("contextMenu");
const cellInfoEl = document.getElementById("cellInfo");
const uploadBtn = document.getElementById("uploadBtn");
const deleteModelBtn = document.getElementById("deleteModelBtn");
const deleteVoxelBtn = document.getElementById("deleteVoxelBtn");
const fileInput = document.getElementById("fileInput");
const statusToast = document.getElementById("statusToast");
const filterPanel = document.getElementById("filterPanel");
const toggleAllBtn = document.getElementById("toggleAllBtn");
const categoryBtns = document.querySelectorAll(".category-btn");
const filterCheckboxes = document.querySelectorAll(".filter-item input");

// Configuration - 6x6x3 voxel grid (dimensions in meters)
const GRID_DIVISIONS = 6;
const VOXEL_WIDTH = 6;   // 6 meters wide (X)
const VOXEL_DEPTH = 6;   // 6 meters deep (Z)
const VOXEL_HEIGHT = 3;  // 3 meters tall (Y)
const HALF_WIDTH = VOXEL_WIDTH / 2;
const HALF_DEPTH = VOXEL_DEPTH / 2;
const HALF_HEIGHT = VOXEL_HEIGHT / 2;
const GRID_SIZE_X = GRID_DIVISIONS * VOXEL_WIDTH;   // 36 meters
const GRID_SIZE_Z = GRID_DIVISIONS * VOXEL_DEPTH;   // 36 meters
const MAX_HEIGHT_LEVELS = 3;  // Maximum 3 voxels high (9 meters total)

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
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(40, 30, 60);  // Adjusted for 36m x 36m grid in meters
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lights - strong lighting for model visibility
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(50, 100, 50);
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
  side: THREE.DoubleSide
});
const faceHighlight = new THREE.Mesh(faceGeoHorizontal, faceMaterial);
const faceEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
faceHighlight.visible = false;
scene.add(faceHighlight);

// Ghost voxel preview (shows where new voxel will be placed)
const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88, opacity: 0.2, transparent: true });
const ghostMesh = new THREE.Mesh(voxelGeo, ghostMaterial);
const ghostWireMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
const ghostWire = new THREE.LineSegments(wireframeGeo, ghostWireMat);
ghostMesh.add(ghostWire);
ghostMesh.visible = false;
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
scene.add(gridHelper);

// Ground plane (for raycasting)
const planeGeo = new THREE.PlaneGeometry(GRID_SIZE_X, GRID_SIZE_Z);
planeGeo.rotateX(-Math.PI / 2);
const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ visible: false }));
scene.add(plane);

// Raycasting
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objects = [plane];

// State
const voxelData = new Map();
let selectedVoxel = null;
let voxelForUpload = null;  // Stores voxel when upload button is clicked
let voxelsVisible = true;

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
function createVoxel(position, category = 'none') {
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
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(voxelGeo, material);
  mesh.renderOrder = 2;
  group.add(mesh);

  // Wireframe - full opacity for electric look
  const wireMat = new THREE.LineBasicMaterial({ color: color, transparent: false, linewidth: 2 });
  const wireframe = new THREE.LineSegments(wireframeGeo, wireMat);
  wireframe.renderOrder = 2;
  group.add(wireframe);

  group.userData = { isVoxel: true, category: category, mesh, wireframe, wireMat };
  scene.add(group);
  objects.push(group);

  const key = getVoxelKey(position);
  voxelData.set(key, { voxel: group, model: null, modelUrl: null, category: category });

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

// Remove voxel
function removeVoxel(voxelGroup) {
  const key = getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (data) {
    if (data.model) scene.remove(data.model);
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
  const key = getVoxelKey(voxelGroup.position);
  const data = voxelData.get(key);
  if (!data) return false;

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

        // Scale model to fit voxel while preserving relative position to origin
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        if (maxDim > 0 && isFinite(maxDim)) {
          // Scale to fit within voxel (model's origin stays at 0,0,0)
          // Scale to fit the smallest voxel dimension (height = 3m)
          const scale = VOXEL_HEIGHT / maxDim;
          model.scale.setScalar(scale);
          console.log('Model scaled by:', scale, 'original size:', maxDim);
        }

        // Each voxel has its own local origin at bottom center
        // Model's 0,0,0 aligns with voxel's bottom center
        const container = new THREE.Group();

        // Position container at voxel's bottom center
        container.position.set(
          voxelGroup.position.x,
          voxelGroup.position.y - HALF_HEIGHT,  // Bottom of voxel
          voxelGroup.position.z
        );

        container.add(model);
        scene.add(container);
        data.model = container;
        data.modelUrl = url;

        console.log('Model placed at voxel bottom center:', container.position);
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
        const voxel = createVoxel(pos, category);
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
      const voxel = createVoxel(pos, category);
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

// Context menu
function showContextMenu(x, y, voxelGroup) {
  selectedVoxel = voxelGroup;
  const pos = voxelGroup.position;
  const cat = voxelGroup.userData.category || 'none';
  cellInfoEl.textContent = `${CATEGORIES[cat].name} (${Math.round(pos.x/VOXEL_WIDTH)}, ${Math.round(pos.y/VOXEL_HEIGHT)}, ${Math.round(pos.z/VOXEL_DEPTH)})`;

  const key = getVoxelKey(pos);
  const data = voxelData.get(key);
  deleteModelBtn.style.display = (data && data.modelUrl) ? 'flex' : 'none';

  // Update category button selection
  updateCategoryButtonSelection();

  // Position menu
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');

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
  // Only show highlight when Control key is held and voxels are visible
  if (!voxelsVisible || !e.ctrlKey) {
    faceHighlight.visible = false;
    ghostMesh.visible = false;
    canvas.style.cursor = 'default';
    pendingVoxelPos = null;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const normal = intersect.face.normal.clone();
    const voxelGroup = getVoxelGroup(intersect.object);

    let facePos, newVoxelPos;

    if (voxelGroup) {
      // Hovering over existing voxel - get the face position
      // Transform normal to world space
      normal.transformDirection(intersect.object.matrixWorld);
      normal.round();  // Normalize to axis-aligned

      // Calculate offset based on normal direction
      const halfOffset = new THREE.Vector3(
        normal.x * HALF_WIDTH,
        normal.y * HALF_HEIGHT,
        normal.z * HALF_DEPTH
      );
      const fullOffset = new THREE.Vector3(
        normal.x * VOXEL_WIDTH,
        normal.y * VOXEL_HEIGHT,
        normal.z * VOXEL_DEPTH
      );

      // Face center is on the surface of the voxel
      facePos = voxelGroup.position.clone().add(halfOffset);

      // New voxel position is adjacent to this face
      newVoxelPos = voxelGroup.position.clone().add(fullOffset);

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
    // Upload to Vercel Blob API
    const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
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

deleteModelBtn.addEventListener('click', () => {
  if (selectedVoxel) {
    removeModel(selectedVoxel);
    showToast('Model removed', 'success');
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
