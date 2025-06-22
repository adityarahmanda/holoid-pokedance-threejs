import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const base = import.meta.env.BASE_URL;

let renderer = new THREE.WebGLRenderer({
	canvas: document.querySelector('#background'),
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);

//set up the renderer with the default settings for threejs.org/editor - revision r153
renderer.shadows = true;
renderer.shadowType = 1;
renderer.shadowMap.enabled = true;
renderer.setPixelRatio( window.devicePixelRatio );
renderer.toneMapping = 0;
renderer.toneMappingExposure = 1
renderer.useLegacyLights  = false;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0xffffff, 0);
//make sure three/build/three.module.js is over r152 or this feature is not available. 
renderer.outputColorSpace = THREE.SRGBColorSpace 

const scene = new THREE.Scene();
const modelPaths = [
  'models/moona.glb',
  'models/iofi.glb',
  'models/risu.glb',
];
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const clock = new THREE.Clock();
const audio = document.getElementById("bg-audio");

let models = [];
let currentModelIndex = -1;
let sceneReady = false;
let sceneStarted = false;
let deltaTime = 0;
let time = 0;
const loopDuration = 15;

// Camera orbit parameters
let radius = 3;
let angle = Math.PI / 2;
let dragDistance = 0;
let isClick = false;
let isDragging = false;
let previousMouseX = 0;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, radius);
camera.lookAt(0, 1, 0);
scene.add(camera);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 2, 10);
const dirLightTarget = new THREE.Object3D();
dirLightTarget.position.set(0, 0, 0);
scene.add(dirLightTarget);
dirLight.target = dirLightTarget;

scene.add(dirLight);
scene.add(dirLight);

prepareScene();

window.addEventListener('resize', updateCameraAspect);

document.addEventListener('mousedown', (event) => {
  if (!sceneReady || event.button !== 0) return;

  if (!sceneStarted) {
    startScene();
  }

  isDragging = true;
  isClick = true;
  previousMouseX = event.clientX;
});

document.addEventListener('mousemove', (event) => {
  if (!sceneReady) return;

  if (isDragging) {
    const deltaX = event.clientX - previousMouseX;
    dragDistance += Math.abs(deltaX);

    if (dragDistance > 3) {
      isClick = false;
    }

    angle -= deltaX * 0.005;
    previousMouseX = event.clientX;
  }
});

document.addEventListener('mouseup', (event) => {
  if (!sceneReady || event.button !== 0) return;

  isDragging = false;

  if (isClick) {
    showNextModel();
  }
});

async function prepareScene()
{
  await Promise.all(loadAllModels());

  updateCameraAspect();
  models[0].wrapper.visible = true;
  models.forEach(model => {
    startAnimation(model);
  });
  animate();

  sceneReady = true;
}

function startScene() {
  if (!sceneReady) return;
  
  audio.currentTime = time % loopDuration;
  audio.play().catch(e => console.warn('Autoplay failed:', e));

  showNextModel();
  sceneStarted = true;
}

function showNextModel() {
  if (currentModelIndex >= 0) {
    models[currentModelIndex].wrapper.visible = false;
  }

  currentModelIndex = (currentModelIndex + 1) % models.length;
  const model = models[currentModelIndex];
  model.wrapper.visible = true;
}

function startAnimation(model) {
  if (model.animations.length > 0) {
    if (!model.mixer) {
      model.mixer = new THREE.AnimationMixer(model.wrapper);
    }

    model.mixer.stopAllAction();
    model.animations.forEach((clip) => {
      const action = model.mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopOnce).play();
    });
  }
}

function loadAllModels() {
  models = [];
  models.length = modelPaths.length;

  let promises = [];
  modelPaths.map((path, index) => {
    const promise = loadModel(path).then(res => models[index] = res);
    promises.push(promise);
  });

  return promises;
}

function loadModel(modelPath) {
  return new Promise((resolve, reject) => {
    try {
      loader.load(`${base}/${modelPath}`, (gltf) => {
        const modelScene = gltf.scene;
        const modelAnimations = gltf.animations;

        if (modelScene.isObject3D)
        {
          scene.add(modelScene);
          updateModelMaterial(modelScene);
          warmUpModel(modelScene);
          resolve({ wrapper: modelScene, animations: modelAnimations });
        }

        resolve(null);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function warmUpModel(model)
{
  model.visible = true;
  renderer.render(scene, camera);
  model.visible = false;
  renderer.render(scene, camera);
}

function updateModelMaterial(model){
  model.traverse(function (object) {
    if (object.isMesh && object.material) {
      const oldMat = object.material;
      object.material = new THREE.MeshToonMaterial({
        map: oldMat.map || null,
        color: oldMat.color || new THREE.Color(0xffffff),
        transparent: oldMat.transparent || false,
        alphaMap: oldMat.alphaMap || null,
        alphaTest: 0.5,
      });
    }
  });
}

function updateCameraAspect() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  
  deltaTime = clock.getDelta();
  time += deltaTime;
  
  if (sceneStarted && audio.currentTime >= loopDuration) {
    models.forEach(model => {
      startAnimation(model);
    });

    audio.currentTime = 0;
    audio.play();
  }

  models.forEach(model => {
    if (model.mixer) {
      model.mixer.update(deltaTime);
    }
  });
  
  camera.position.x = radius * Math.cos(angle);
  camera.position.z = radius * Math.sin(angle);
  camera.lookAt(0, 1, 0);

  renderer.render(scene, camera);
};
