import * as THREE from 'https://esm.sh/three';
import { PointerLockControls } from 'https://esm.sh/three/examples/jsm/controls/PointerLockControls';
import { VRButton } from 'https://esm.sh/three/examples/jsm/webxr/VRButton';
import { DeviceOrientationControls } from '/static/modules/DeviceOrientationControls.mjs';
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";


console.log({vision});

const { HandLandmarker , FilesetResolver, DrawingUtils } = vision;

const performanceStart = performance.now(); 
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');
let handLandmarker = null;
let latestResults = null;
let landmarkMeshes = [];
let videoTexture = null;
const video = document.getElementById('webcam');

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

Game.renderer.setClearColor(0xffffff);
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
    new THREE.MeshStandardMaterial({ color: 0xff4444 }));
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

async function initHandLandmarker(){
    const filesetResolver = await FilesetResolver.forVisionTasks("/libs/@mediapipe/tasks-vision/wasm");

    console.log({vision, HandLandmarker, FilesetResolver: filesetResolver, DrawingUtils});
    
    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
        //  modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            modelAssetPath: "/libs/@mediapipe/tasks-vision/hand_landmarker.task",
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numHands: 2
    });
}

function centerHand(landmarks) {
    const base = landmarks[0]; // ponto 0 = pulso
    return landmarks.map((pt) => ({
      x: pt.x - base.x,
      y: pt.y - base.y,
      z: pt.z - base.z
    }));
  }

  async function _detectLoop() {
    while (true) {
      if (video.readyState >= 2 && handLandmarker) {
        const now = performance.now();
        const results = handLandmarker.detectForVideo(video, now);
  
        // Ajusta canvas ao vídeo
        overlayCanvas.width = 480;
        overlayCanvas.height = 480;
        // ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  
        if (results.landmarks && results.landmarks.length > 0) {
          const rotation = {
            pitch: -Math.PI / 6, // inclina para frente
            yaw: 0,
            roll: 0
          };
  
          results.landmarks.forEach((landmarks, i) => {
            const handLabel = results.handedness?.[i]?.[0]?.categoryName || "Unknown";
            const color = handLabel === "Left" ? "blue" : "green";
  
            for (const point of landmarks) {
                // Aplica rotação 3D ao ponto
                const rotated = rotate3D(point, rotation);
    
                // ❗ Corrige a inversão horizontal (espelhamento do vídeo)
                const mirroredX = 1.0 - rotated.x;
    
                // Escala e posiciona na tela
                const x = mirroredX * overlayCanvas.width;
                const y = rotated.y * overlayCanvas.height;
    
                // Simula perspectiva via z-depth (tamanho menor = mais distante)
                //   const perspectiveScale = 1 / (1 + rotated.z * 4);
                //   const radius = Math.max(0.5, 6 * perspectiveScale);  // evita valor negativo
                const depthScale = 1 + rotated.z * 2; // z vai de 0 a ~0.4
                // const radius = 6 * depthScale;
                const radius = Math.max(0.5, 6 * depthScale);
            
                console.log({radius: radius.toFixed(2), depth: rotated.z.toFixed(2)});
                
  
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
            }
          });
        }

        // ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
  
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Função para atualizar a posição das mãos
  function updateHandPosition(handMesh, landmarks, results) {
    // Mapeando as coordenadas normalizadas (0-1) para o sistema de coordenadas 3D do Three.js
    const wrist = landmarks[9]; // Ponto do pulso, por exemplo
  
    // Normalizando para o espaço de coordenadas 3D do Three.js (ajustando conforme necessário)
    let x = wrist.x * 2 - 1; // Convertendo de 0-1 para -1 a 1 (para o eixo X)
    const y = -(wrist.y * 2 - 1); // Convertendo de 0-1 para -1 a 1 (para o eixo Y) e invertendo para ajustar a direção
    let z = (wrist.z * 4 - 1); // Ajustando a profundidade (z) dependendo do modelo, mas pode ser necessário um ajuste adicional
    // Aplica o flip horizontal diretamente na coordenada x
    x = -x; // Inverte a coordenada X (flip)
    z = z * 1;
    
   console.log(z);
   
    // Atualiza a posição do objeto no Three.js
    handMesh.position.set(x, y, z);

    // overlayCanvas.width = video.videoWidth;
    // overlayCanvas.height = video.videoHeight;
    // ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // const handLabel = results.handednesses?.[0]?.[0]?.categoryName || "Unknown";
    // const handIndex = results.handednesses?.[0]?.[0]?.index || 0;
    // const color = handLabel === "Left" ? "blue" : "green";
    // console.log({x:landmarks[0].x.toFixed(4), handLabel:handLabel, handIndex, results});


  }


  function onResults(results) {
    if (results.handLandmarks) {
      const landmarks = results.handLandmarks[0]; // Primeira mão detectada (se houver)
  
      // Atualiza a posição da mão no Three.js
      updateHandPosition(Game.players[0].mesh.leftHand, landmarks);
    }
  }

  // Função para processar o quadro e chamar o modelo do MediaPipe
function processVideoFrame() {
    if (!handLandmarker) {
        console.log('HandLandmarker ainda não inicializado.');
        return;
      }
    
      
      const videoFrame = captureVideoFrame(); // Captura o quadro de vídeo atual
      const results = handLandmarker.detect(videoFrame); // Chama a detecção

    
    
      if (results.handednesses && results.handednesses.length > 0) {
        const landmarks = results.landmarks[0]; // Primeira mão detectada
        console.log('Processando quadro...',results);
        updateHandPosition(Game.players[0].mesh.leftHand, landmarks, results);
      }

  }

  function captureVideoFrame() {
    // Cria um canvas temporário
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    // Desenha o quadro atual do vídeo no canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    // Retorna o quadro como uma imagem (pode ser usado como entrada para MediaPipe)
    return canvas;
  }
  

  async function detectLoop() {
    while (true) {
      if (video.readyState >= 2 && handLandmarker) {
        const now = performance.now();
        const results = handLandmarker.detectForVideo(video, now);
        
       
        
   
        // Ajusta o canvas ao tamanho do vídeo
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
       /*
        // Aplica transformação para rotação no canvas (primeira pessoa)
        const rotationAngle = Math.PI / 6; // Rotação de 30 graus, ajuste conforme necessário
        ctx.setTransform(
          Math.cos(rotationAngle), Math.sin(rotationAngle), 
          -Math.sin(rotationAngle), Math.cos(rotationAngle),
          overlayCanvas.width / 2, overlayCanvas.height / 2
        );
         */
        // Agora desenha os landmarks com a rotação aplicada ao canvas
        if (results.landmarks && results.landmarks.length > 0) {
        
          results.landmarks.forEach((landmarks, i) => {


            
            const handLabel = results.handednesses?.[i]?.[0]?.categoryName || "Unknown";
            const handIndex = results.handednesses?.[i]?.[0]?.index || 0;
            const color = handLabel === "Left" ? "blue" : "green";
            console.log({x:landmarks[9]});

            landmarks.forEach((point) => {
              // Aplica rotação nos pontos individuais
              const rotated = rotate3D(point, { pitch: -Math.PI / 6, yaw: 0, roll: 0 });
  
              // Corrige inversão horizontal
              const mirroredX = 1.0 - rotated.x;
  
              // Escala e posiciona na tela com perspectiva (opcional, mas você pode manter)
              const x = mirroredX * overlayCanvas.width;
              const y = rotated.y * overlayCanvas.height;
              const z = rotated.z * overlayCanvas.height;
  
              // Desenha o ponto na tela
              ctx.beginPath();
              const flippedX = overlayCanvas.width - point.x.toFixed(4) * overlayCanvas.width;
              ctx.arc(flippedX, point.y.toFixed(4) * overlayCanvas.height, 10, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.closePath(); // Fecha o caminho
            });

            if(handLabel === "Left") {
                updateHandPosition(Game.players[0].mesh.rightHand, landmarks, results);
            }

            if(handLabel === "Right") {
                updateHandPosition(Game.players[0].mesh.leftHand, landmarks, results);
            }
            
         

            /*
            for (const point of landmarks) {
              // Aplica rotação nos pontos individuais
              const rotated = rotate3D(point, { pitch: -Math.PI / 6, yaw: 0, roll: 0 });
  
              // Corrige inversão horizontal
              const mirroredX = 1.0 - rotated.x;
  
              // Escala e posiciona na tela com perspectiva (opcional, mas você pode manter)
              const x = mirroredX * overlayCanvas.width;
              const y = rotated.y * overlayCanvas.height;
  
              // Ajusta a profundidade (escala)
              const depthScale = 1 + rotated.z * 2;
              const radius = Math.max(0.5, 6 * depthScale);
  
              // Desenha no canvas
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }
                */
          });
        
        }

       
      }
  
      await new Promise(r => setTimeout(r, 5)); // espera 100ms
    }
  }

function rotate3D(point, angles) {
    const { x, y, z } = point;
    const { pitch, yaw, roll } = angles; // em radianos
  
    // Rotação em torno do eixo X (pitch)
    let y1 = y * Math.cos(pitch) - z * Math.sin(pitch);
    let z1 = y * Math.sin(pitch) + z * Math.cos(pitch);
    let x1 = x;
  
    // Rotação em torno do eixo Y (yaw)
    let x2 = x1 * Math.cos(yaw) + z1 * Math.sin(yaw);
    let z2 = -x1 * Math.sin(yaw) + z1 * Math.cos(yaw);
    let y2 = y1;
  
    // Rotação em torno do eixo Z (roll)
    let x3 = x2 * Math.cos(roll) - y2 * Math.sin(roll);
    let y3 = x2 * Math.sin(roll) + y2 * Math.cos(roll);
    let z3 = z2;
  
    return { x: x3, y: y3, z: z3 };
}

function loopHandLandmarker() {
  // Limpa landmarks antigos
//   landmarkMeshes.forEach(mesh => Game.camera.remove(mesh));
  landmarkMeshes = [];

  console.log('aqui');

  if (latestResults?.landmarks?.length > 0) {
    latestResults.landmarks.forEach(handLandmarks => {
        handLandmarks.forEach((point) => {
        //   const x = (point.x - 0.5) * 2;
        //   const y = -(point.y - 0.5) * 2;
        //   const z = point.z * 40; // <-- z positivo para estar NA FRENTE
  
        //   const sphere = new THREE.Mesh(
        //     new THREE.SphereGeometry(0.02),
        //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
        //   );
  
        //   sphere.position.set(x, y, z);
        //   Game.camera.add(sphere); // Agora vai seguir a câmera
        //   landmarkMeshes.push(sphere);
          console.log({point});
          
        });
      });
  }
}

function webcamEnabled() {

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    // Solicita a webcam
    navigator.mediaDevices.getUserMedia({ video: {
        facingMode: { ideal: "user" }, // "environment" ou "user"
        // width: { ideal: 480 },               // largura desejada
        // height: { ideal: 360 }                // altura desejada
    } }).then((stream) => {
      video.srcObject = stream;
      video.play();
      initHandLandmarker();
    });

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

function handlerResize(event){
    Game.camera.aspect = window.innerWidth / window.innerHeight;
    Game.camera.updateProjectionMatrix();
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
}

function handlertouchstart(event){
    const touch = event.touches[0];
    Game.inputs[3].touchStartX = touch.clientX;
    Game.inputs[3].touchStartY = touch.clientY; 
}

function handlerTouchmove(event){
    const touch = event.touches[0];

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
}

function handlerKeysTouch(event){
    if(Game.divice.mobile){
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
}

function handlerDevicemotion(event){

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
}

function animate() {

    // requestAnimationFrame(animate);
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

    // loopHandLandmarker();
    // Processa o quadro da câmera
    // processVideoFrame();

    Game.renderer.render(Game.scene, Game.camera);
}

webcamEnabled();
detectLoop();

Game.renderer.setAnimationLoop(animate);


window.addEventListener('DOMContentLoaded', handlerKeysTouch);
window.addEventListener('resize', handlerResize);
document.addEventListener("touchstart", handlertouchstart);
document.addEventListener("touchmove", handlerTouchmove);
window.addEventListener("devicemotion", handlerDevicemotion, true);

