import * as THREE from 'https://esm.sh/three';
import { PointerLockControls } from 'https://esm.sh/three/examples/jsm/controls/PointerLockControls';
import { VRButton } from 'https://esm.sh/three/examples/jsm/webxr/VRButton';
import { DeviceOrientationControls } from '/static/modules/DeviceOrientationControls.mjs';

const performanceStart = performance.now(); 

const Game = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000),
    clock: new THREE.Clock(),
    renderer: new THREE.WebGLRenderer({ antialias: true }),
    objAmbientLight: {
        ambientLight: new THREE.AmbientLight(0x888888),
        directionalLight: new THREE.DirectionalLight(0xffffff, 1)
    },
    level: {
        floor: new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x999999, side: THREE.DoubleSide })
        )
    },
    players: [
        {
            tag: 'player one',
            name: 'John Due',
            mesh:{
                leftHand: null,
                rightHand: null
            }
        }
    ],
    inputs: [
        {name: "Joystick virtual"},
        {name: "keyboard"},
        {name: "touchscreen"},
        {name: "devices", events:{
            touchStartX:0,
            touchStartY:0
        }}
    ],
    divice: {
        mobile: (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
    }
}

Game.renderer.setSize(window.innerWidth, window.innerHeight);
Game.renderer.xr.enabled = true;
Game.objAmbientLight.directionalLight.position.set(10, 10, 10);

if (Game.divice.mobile) {
    Game.controlsMobile = new DeviceOrientationControls(Game.camera);
    Game.controls = new PointerLockControls(Game.camera, document.body);
} else {
    Game.controls = new PointerLockControls(Game.camera, document.body);
}

async function requestDeviceOrientationPermission() {
    if (typeof Game.controlsMobile !== 'undefined' && typeof Game.controlsMobile.requestPermission === 'function') {

        try {
            const response = await Game.controlsMobile.requestPermission();
            if (response === 'granted') {
                alert('✅ Permissão concedida para sensores!');
                console.log('✅ Permissão concedida para sensores!');
            } else {
                alert('⚠️ Permissão negada para sensores!');
                console.warn('⚠️ Permissão negada para sensores!');
            }
        } catch (error) {
            alert('Erro ao solicitar permissão de orientação');
            console.error('Erro ao solicitar permissão de orientação:', error);
        }
  
    } else {
        alert('🔓 Permissão não necessária (Android ou desktop)');
        console.log('🔓 Permissão não necessária (Android ou desktop)');
    }
}

await requestDeviceOrientationPermission();

document.body.appendChild(Game.renderer.domElement);
document.body.appendChild(VRButton.createButton(Game.renderer));
if (!Game.divice.mobile) document.querySelector('#mobile-controls').style.display = 'none';

const instructions = document.getElementById('instructions');

if (!Game.divice.mobile) {
    instructions.addEventListener('click', () => Game.controls.lock());
    Game.controls.addEventListener('lock', () => instructions.style.display = 'none');
    Game.controls.addEventListener('unlock', () => instructions.style.display = '');
} else {
    instructions.style.display = 'none'; // Não exibe instruções no mobile
}


Game.scene.add(Game.objAmbientLight.directionalLight);
Game.scene.add(Game.objAmbientLight.ambientLight);
Game.scene.add(Game.controls.object);


// Chão
Game.level.floor.rotation.x = -Math.PI / 2;
Game.level.floor.position.y = -1;
Game.scene.add(Game.level.floor);

// Mãos
const handGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const handMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
Game.players[0].mesh.leftHand = new THREE.Mesh(handGeo, handMat);
Game.players[0].mesh.rightHand = new THREE.Mesh(handGeo, handMat);

Game.players[0].mesh.leftHand.position.set(-0.3, -0.3, -0.7);
Game.players[0].mesh.rightHand.position.set(0.3, -0.3, -0.7);
Game.camera.add(Game.players[0].mesh.leftHand);
Game.camera.add(Game.players[0].mesh.rightHand);




// Cubo com física fake
const cubeSize = 1;
const physicsCube = new THREE.Mesh(
  new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
  new THREE.MeshStandardMaterial({ color: 0xff4444 })
);
physicsCube.position.set(0, 0, -5);
Game.scene.add(physicsCube);

const cubeVelocity = new THREE.Vector3();
const keys = {};
const vVelocity = new THREE.Vector3();


document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);


const geometry = new THREE.BoxGeometry( 1, 1, 1 ); 
const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} ); 
const cube = new THREE.Mesh( geometry, material ); 
const cameraDirection = new THREE.Vector3();
Game.camera.getWorldDirection(cameraDirection);
Game.scene.add( cube );
// cube.position.copy(Game.camera.position).add(cameraDirection.multiplyScalar(-2));
cube.position.set(10, 0, -5);


function infoGame (){
    console.log({performance: performance.now() - performanceStart, clock: Game.clock.getDelta()});
    setTimeout(infoGame, 100);
}

function setVelocityXZY({vVelocity, keys, delta}){
    vVelocity.set(0, 0, 0);
    if (keys['KeyW']) vVelocity.z += 5 * delta;
    if (keys['KeyS']) vVelocity.z -= 5 * delta;
    if (keys['KeyA']) vVelocity.x -= 5 * delta;
    if (keys['KeyD']) vVelocity.x += 5 * delta;
    return {vVelocity, keys, delta}
}

function getControlsPosition(controls){
    return controls.object.position;
}

function animate() {

//   requestAnimationFrame(animate);
  const delta = Game.clock.getDelta();


  setVelocityXZY({vVelocity, keys,  delta});

  Game.controls.moveRight(vVelocity.x);
  Game.controls.moveForward(vVelocity.z);

  const cubePosition = physicsCube.position;
  if (getControlsPosition(Game.controls).distanceTo(cubePosition) < 1.5) {
    // Empurra o cubo com base na direção do jogador
    const pushDir = new THREE.Vector3().subVectors(cubePosition, getControlsPosition(Game.controls)).normalize();
    cubeVelocity.addScaledVector(pushDir, 3 * delta);
  }
  // Atualiza a posição do cubo com inércia e atrito
  physicsCube.position.addScaledVector(cubeVelocity, delta);
  cubeVelocity.multiplyScalar(0.9); // atrito

  Game.renderer.render(Game.scene, Game.camera);
}

Game.renderer.setAnimationLoop(animate);

window.addEventListener('DOMContentLoaded', () => {
    if((/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))){
        const forwardBtn = document.getElementById("move-forward");
        const backwardBtn = document.getElementById("move-backward");
      
        forwardBtn.addEventListener("touchstart", (e) => {
          e.preventDefault();
          keys["KeyW"] = true;
        });
        forwardBtn.addEventListener("touchend", (e) => {
          e.preventDefault();
          keys["KeyW"] = false;
        });
      
        backwardBtn.addEventListener("touchstart", (e) => {
          e.preventDefault();
          keys["KeyS"] = true;
        });
        backwardBtn.addEventListener("touchend", (e) => {
          e.preventDefault();
          keys["KeyS"] = false;
        });
      
        // Prevenir o menu de contexto
        forwardBtn.addEventListener("contextmenu", e => e.preventDefault());
        backwardBtn.addEventListener("contextmenu", e => e.preventDefault());
    }
});

window.addEventListener('resize', () => {
    Game.camera.aspect = window.innerWidth / window.innerHeight;
    Game.camera.updateProjectionMatrix();
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    Game.inputs[3].touchStartX = touch.clientX;
    Game.inputs[3].touchStartY = touch.clientY;
});

document.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];

    const dx = touch.clientX - Game.inputs[3].touchStartX;
    const dy = touch.clientY - Game.inputs[3].touchStartY;
    
  
    // Simular rotação da câmera
    // Game.camera.rotation.y -= dx * 0.002;
    // Game.camera.rotation.x -= dy * 0.002;
    // Game.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Game.camera.rotation.x));
    Game.camera.rotation.y -= dx * 0.002;
    // Game.camera.rotation.x -= dy * 0.002;
    // Game.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Game.camera.rotation.x));
  
    Game.inputs[3].touchStartX = touch.clientX;
    Game.inputs[3].touchStartY = touch.clientY;
});
  
window.addEventListener("devicemotion", (event) => {

    // document.querySelector('.infoSystem').innerHTML = `acceleration (x: ${event.accelerationIncludingGravity.x.toFixed(2)} y:${event.accelerationIncludingGravity.y.toFixed(2)})`

    return
  const accel = event.acceleration; 
  const accelG = event.accelerationIncludingGravity;
  const rotRate = event.rotationRate; // alpha, beta, gamma em °/s

  // Aceleração sem gravidade
  console.log("Aceleração X:", accel.x, "m/s²");

  // Aceleração incluindo gravidade
  console.log("Aceleração c/ gravidade X:", accelG.x, "m/s²");

  // Velocidade de rotação
  console.log("Rot rate alpha:", rotRate.alpha, "°/s");
 
}, true);

