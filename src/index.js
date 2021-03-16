import * as THREE from 'three';
import * as CANNON from 'cannon';

let camera, renderer, scene;
let score, gameOver, restart;
let world;
let stack = [];
let overhangs = [];
const originalBlockSize = 3;
const boxHeight = 1;

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length;

  const layer = generateBox(x, y, z, width, depth);
  layer.direction = direction;

  stack.push(layer);
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1);

  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls = false) {
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

  const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`);
  const material = new THREE.MeshLambertMaterial({ color });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);

  scene.add(mesh);

  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  );
  const mass = falls ? 5 : 0;
  const body = new CANNON.Body({ mass, shape});
  body.position.set(x, y, z);
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth
  };
}

function restartGame() {
  stack = [];
  overhangs = [];
  isGameStarted = false;
  gameOver.style.visibility = 'hidden';
  renderer.setAnimationLoop(null);

  for (let i = scene.children.length - 1; i >= 0; i--) {
    if(scene.children[i].type === "Mesh")
      scene.remove(scene.children[i]);
  }

  camera.position.set(10, 10, 10);

  addLayer(0, 0, originalBlockSize, originalBlockSize);

  score.textContent = stack.length - 1;
}

function init() {
  world = new CANNON.World();
  world.gravity.set(0, -10, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;

  scene = new THREE.Scene();

  addLayer(0, 0, originalBlockSize, originalBlockSize);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 0);
  scene.add(directionalLight);

  // Camera
  const aspectRatio = window.innerHeight / window.innerWidth;
  const width = aspectRatio >= 1 ? 10 : 15;
  const height = width * aspectRatio;

  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    1,
    100
  );
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  document.body.appendChild(renderer.domElement);

  score = document.querySelector('#score');
  score.textContent = stack.length - 1;
  gameOver = document.querySelector('.game-over');
  restart = document.querySelector('.game-over__restart');

  restart.addEventListener('click', restartGame);
}

let isGameStarted = false;

const onTap = () => {
  if (!isGameStarted) {
    addLayer(-10, 0, originalBlockSize, originalBlockSize, 'x');

    renderer.setAnimationLoop(animation);
    isGameStarted = true;
  } else {
    const topLayer = stack[stack.length - 1];
    const prevLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const delta = topLayer.threejs.position[direction] -
      prevLayer.threejs.position[direction];
    const overhangSize = Math.abs(delta);

    const size = direction === 'x' ? topLayer.width : topLayer.depth;

    const overlap = size - overhangSize;

    if (overlap > 0) {
      const newWidth = direction === 'x' ? overlap : topLayer.width;
      const newDepth = direction === 'z' ? overlap : topLayer.depth;

      topLayer.width = newWidth;
      topLayer.depth = newDepth;

      topLayer.threejs.scale[direction] = overlap / size;
      topLayer.threejs.position[direction] -= delta / 2;

      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
      const overhangX = direction === 'x'
        ? topLayer.threejs.position.x + overhangShift
        : topLayer.threejs.position.x;
      const overhangZ = direction === 'z'
        ? topLayer.threejs.position.z + overhangShift
        : topLayer.threejs.position.z;
      const overhangWidth = direction === 'x' ? overhangSize : newWidth;
      const overhangDepth = direction === 'z' ? overhangSize : newDepth;

      addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

      const nextX = direction === 'x' ? topLayer.threejs.position.x : -10;
      const nextZ = direction === 'z' ? topLayer.threejs.position.z : -10;
      const nextDirection = direction === 'x' ? 'z' : 'x';

      score.textContent = stack.length - 1;

      addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    }
  }
};

window.addEventListener('click', onTap);
window.addEventListener('touchend', onTap);

function isGameOver() {
  const topLayer = stack[stack.length - 1];
  const howFarWeAre = topLayer.threejs.position[topLayer.direction];

  if (howFarWeAre > 10) {
    renderer.setAnimationLoop(null);
    gameOver.style.visibility = 'visible';
  }
}

function animation() {
  const speed = 0.15;

  const topLayer = stack[stack.length - 1];
  topLayer.threejs.position[topLayer.direction] += speed;

  isGameOver();

  if (camera.position.y < boxHeight * (stack.length - 1) + 8) {
    camera.position.y += speed;
  }

  updatePhysics();
  renderer.render(scene, camera);
}

function updatePhysics() {
  world.step(1 / 60);

  overhangs.forEach(element => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

init();
