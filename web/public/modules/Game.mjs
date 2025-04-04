import * as THREE from 'https://esm.sh/three';
import { VRButton } from 'https://esm.sh/three/examples/jsm/webxr/VRButton';
import { GLTFLoader } from 'https://esm.sh/three/examples/jsm/loaders/GLTFLoader';
import { PointerLockControls }          from 'https://esm.sh/three/examples/jsm/controls/PointerLockControls';
import { DeviceOrientationControls }    from '/static/modules/DeviceOrientationControls.mjs';
import * as dat from 'https://esm.sh/dat.gui';
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";
// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const DEBUGGER = true;

const { HandLandmarker , FilesetResolver, DrawingUtils } = vision;
const performanceStart = performance.now(); 
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');

let handLandmarker = null;
let latestResults = null;
let landmarkMeshes = [];
let videoTexture = null;
let previousZ = 0; // Raio/valor inicial de z
let radius = 0.1;
let frameCounter = 0;
let handModelRight = null;
let handBonesRight = null;
let valorAnterior = null;
const video = document.getElementById('webcam');

const boneMapRight = {
    0: 'mixamorigRightHand',
    1: 'mixamorigRightHandThumb1',
    2: 'mixamorigRightHandThumb2',
    3: 'mixamorigRightHandThumb3',
    4: 'mixamorigRightHandThumb4',
    5: 'mixamorigRightHandIndex1',
    6: 'mixamorigRightHandIndex2',
    7: 'mixamorigRightHandIndex3',
    8: 'mixamorigRightHandIndex4',
    9: 'mixamorigRightHandMiddle1',
   10: 'mixamorigRightHandMiddle2',
   11: 'mixamorigRightHandMiddle3',
   12: 'mixamorigRightHandMiddle4',
   13: 'mixamorigRightHandRing1',
   14: 'mixamorigRightHandRing2',
   15: 'mixamorigRightHandRing3',
   16: 'mixamorigRightHandRing4',
   17: 'mixamorigRightHandPinky1',
   18: 'mixamorigRightHandPinky2',
   19: 'mixamorigRightHandPinky3',
   20: 'mixamorigRightHandPinky4',
  };

const handConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20]
];

window.Game = {
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
                rightHand: null,
                hands: {
                    left: {
                        prevLandmarks: null,
                        bones : {},
                        model : null
                    },
                    right: {
                        prevLandmarks: null,
                        bones : {},
                        model : null
                    },
                }
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

const handRotationOffset = {
    x: 0,   // graus
    y: 0,
    z: 180
};

Game.renderer.setClearColor(0xffffff);
Game.renderer.setSize(window.innerWidth, window.innerHeight);
Game.renderer.xr.enabled = true;
Game.objAmbientLight.directionalLight.position.set(10, 10, 10);
Game.camera.lookAt(0, 0, 0);

Game.scene.add(new THREE.GridHelper( 200, 200 ));

const cameraHelper = new THREE.CameraHelper( Game.camera );
Game.scene.add( cameraHelper );

if (Game.divice.mobile) {
    Game.controlsMobile = new DeviceOrientationControls(Game.camera);
    Game.controls = new PointerLockControls(Game.camera, document.body);
} else {
    Game.controls = new PointerLockControls(Game.camera, document.body);
}

Game.controls.object.position.set(0, 1.8, 3);

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

//TODO: Remover
// instructions.style.display = 'none'; // Não exibe instruções no mobile

Game.scene.add(Game.objAmbientLight.directionalLight);
Game.scene.add(Game.objAmbientLight.ambientLight);
Game.scene.add(Game.controls.object);

// Chão
Game.level.floor.rotation.x = -Math.PI / 2;
Game.level.floor.position.y = -1;
Game.scene.add(Game.level.floor);

// Mãos
const handGeo = new THREE.BoxGeometry(0.02, 0.02, 0);
const handMatRight = new THREE.MeshStandardMaterial({ color: 0x0000ff  });
const handMatLeft = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
Game.players[0].mesh.leftHand = new THREE.Mesh(handGeo, handMatLeft);
Game.players[0].mesh.rightHand = new THREE.Mesh(handGeo, handMatRight);

// Game.players[0].mesh.leftHand.position.set(-0.3, -0.3, -0.7);
// Game.players[0].mesh.rightHand.position.set(0.3, -0.3, -0.7);
// Game.camera.add(Game.players[0].mesh.leftHand);
// Game.camera.add(Game.players[0].mesh.rightHand);

// Cubo com física fake
const cubeSize = 1;
const physicsCube = new THREE.Mesh(
    new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
    new THREE.MeshStandardMaterial({ color: 0xff4444 }));
physicsCube.position.set(0, 0.5, 0);
physicsCube.add(new THREE.AxesHelper(1));
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
cube.position.set(10, 0.5, 0);
cube.add(new THREE.AxesHelper(1));
// cube.add(new THREE.PolarGridHelper( 10, 16, 6, 64 ));


  
const gui = new dat.GUI();
const folder = gui.addFolder('Hand Rotation Offset');
folder.add(handRotationOffset, 'x', -180, 180).step(1).name('X - inclinação');
folder.add(handRotationOffset, 'y', -180, 180).step(1).name('Y - palma');
folder.add(handRotationOffset, 'z', -180, 180).step(1).name('Z - lateral');
folder.open();



function infoGame (){
    console.log({performance: performance.now() - performanceStart, clock: Game.clock.getDelta()});
    setTimeout(infoGame, 100);
}

async function webcamEnabled() {
    DEBUGGER && console.log("[webcamEnabled]");
    
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    if (!overlayCanvas) {
        alert("Canvas não encontrado!");
        return;
    }

    // Solicita a webcam
    await navigator.mediaDevices.getUserMedia({ 
        video: {
            facingMode: Game.divice.mobile ? "environment" : "user", // Para usar a câmera frontal (se disponível)
            width: { ideal: 640  }, // Resolução de 1280px de largura (ideal para detecção precisa)
            height: { ideal: 480 }, // Resolução de 720px de altura
            frameRate: { ideal: 30, max: 60 }, // Taxa de quadros ideal de 30fps, podendo chegar a 60fps
        }
     }).then((stream) => {
        video.srcObject = stream;
        video.play();
        
        // Verifica se o vídeo foi carregado antes de iniciar o HandLandmarker
        video.addEventListener('loadeddata', () => {
            console.log('Webcam carregada');
            initHandLandmarker().then( ()=>{
                detectLoop().then( uploadGLTF );
            }); // Inicializa o HandLandmarker após o vídeo ser carregado
        });
      
    });

}

async function bootstrap() {
    DEBUGGER && console.log("[bootstrap]");
    webcamEnabled().then( ()=>{
        Game.players[0].mesh.hands.right = createHandpointsMesh('right');
        Game.players[0].mesh.hands.left = createHandpointsMesh('left');
    } );
}

async function initHandLandmarker(){
    DEBUGGER && console.log("[initHandLandmarker]");
    const filesetResolver = await FilesetResolver.forVisionTasks("/libs/@mediapipe/tasks-vision/wasm");

    // Verifique se o canvas e o vídeo estão disponíveis
    if (!overlayCanvas || !video) {
        console.error("Canvas ou vídeo não encontrados!");
        return;
    }

    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
        //  modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            modelAssetPath: "/libs/@mediapipe/tasks-vision/hand_landmarker.task",
            delegate: "GPU"
        },
        outputFaceBlendshapes: false,
        // minTrackConfidence: 0.4, // Ajuste conforme necessário 0.0 - 1.0	0.5
        // minHandPresenceConfidence: 0.0, // Ajuste conforme necessário
        // minHandDetectionConfidence: 0.5,
        runningMode: "VIDEO",
        numHands: 2
    });
  
}

function createHandpointsMesh(label) {

    DEBUGGER && console.log(`[createHandpointsMesh][${label}]`);

    Game.players[0].mesh.hands.right.prevLandmarks = Game.players[0].mesh.hands.right.prevLandmarks || null;
    Game.players[0].mesh.hands.left.prevLandmarks  = Game.players[0].mesh.hands.left.prevLandmarks  || null;

    // 2. Criação de uma Geometria para os Pontos
    // Supondo que cada mão tenha 21 landmarks; ajuste conforme o retorno do seu modelo. ou 42 se estiver trabalhando com 2 mãos
    const positions = new Float32Array(42 * 3); // 3 coordenadas por ponto (x, y, z)
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 3. Material e Objeto Points
    const pointsMaterial = new THREE.PointsMaterial({ color: label === 'left' ? 0x0000ff : 0x00ff00 , size: 0.07, transparent: true, opacity: 0.5 });
    const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);

    // ✅ Novo grupo para agrupar pontos + eixo
    const handGroup = new THREE.Group();
    // handGroup.position.set(0.5, -0.5, -1.5); // posição base da mão
    handGroup.add(pointsMesh);              // adiciona os pontos ao grupo
    const axesHelper = new THREE.AxesHelper(0.3);
    handGroup.add(axesHelper); // adiciona o eixo

    // Game.camera.add(pointsMesh);
     // Adiciona o grupo à câmera (ou cena)
     Game.camera.add(handGroup);

    // Posicione o mesh em uma posição que simule as mãos em primeira pessoa
    // pointsMesh.position.set(0.5, -0.5, -1.5);
    // pointsMesh.add(new THREE.AxesHelper(0.1));

    // const arrowHelperGrup = new THREE.Group();
    // const eixo_x = new THREE.Vector3( 1, 0, 0 ).normalize();
    // const eixo_y = new THREE.Vector3( 0, 1, 0 ).normalize();
    // const eixo_z = new THREE.Vector3( 0, 0, 1).normalize();
    // const origin = new THREE.Vector3( 0.5, -0.5, -1.5 );
    // const length = 0.3;
    // const arrowHelperX = new THREE.ArrowHelper( eixo_x, origin, length, 0xff0000 );
    // const arrowHelperY = new THREE.ArrowHelper( eixo_y, origin, length, 0x00ff00 );
    // const arrowHelperZ = new THREE.ArrowHelper( eixo_z, origin, length, 0x0000ff );
    // arrowHelperGrup.add( arrowHelperY );
    // arrowHelperGrup.add( arrowHelperZ );
    // arrowHelperGrup.add( arrowHelperX );
    // Game.camera.add( arrowHelperGrup );

    // Número de conexões e vértices (2 pontos por conexão)
    const numEdges = handConnections.length;
    const positionsEdges = new Float32Array(numEdges * 2 * 3); // 3 coordenadas por vértice
    // Cria a geometria para as arestas
    const edgesGeometry = new THREE.BufferGeometry();
    edgesGeometry.setAttribute('position', new THREE.BufferAttribute(positionsEdges, 3));
    // Material para desenhar as linhas (edges)
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    // Cria o mesh que representa as arestas
    const edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    Game.camera.add(edgesMesh);
    edgesMesh.position.set(0.5, -0.5, -1.5); // mesma posição dos pontos


    return { label, pointsMesh, pointsGeometry, edgesMesh, edgesGeometry,   prevLandmarks: null, group: handGroup,axesHelper};

}

// Função para suavizar os pontos usando interpolação exponencial
function smoothPoints(prevPoints, currPoints, alpha = 0.5) {
    return currPoints.map((point, idx) => {
      if (prevPoints && prevPoints[idx]) {
        return {
          x: alpha * prevPoints[idx].x + (1 - alpha) * point.x,
          y: alpha * prevPoints[idx].y + (1 - alpha) * point.y,
          z: alpha * prevPoints[idx].z + (1 - alpha) * point.z
        };
      }
      return point;
    });
}

// 4. Função para Atualizar os Vértices com os Landmarks
function updatePoints(hand, landmarks, label) {

    
    // landmarks: array de objetos com {x, y, z} em coordenadas normalizadas (0 a 1)
    const positionAttr = hand.pointsGeometry.getAttribute('position');

    // let r = calcularRaio( landmarks[5], landmarks[17] );
    // let re = escalarValor(r, 0, 0.18, 3, 6);
    // let ri = inverterCrescimento(re, 0, 0.18);
    // console.log({r, ri, re});
    // const scale = re ; 

    const scale = 3; 

    // Se existirem pontos anteriores, suaviza os novos pontos
    const smoothLandmarks = hand.prevLandmarks 
    ? smoothPoints(hand.prevLandmarks, landmarks, 0.8)
    : landmarks;

    // for (let i = 0; i < landmarks.length; i++) {
    //   // Mapeia as coordenadas normalizadas para o sistema de coordenadas do Three.js
    //   let x = (landmarks[i].x - 0.5) * scale;      // de 0-1 para -1 a 1
    //   let y = -(landmarks[i].y - 0.5) * scale;     // inverte o eixo y, pois no canvas y aumenta para baixo
    //   let z = landmarks[i].z * scale;                // ajuste conforme necessário
    //   x = -x; // Inverte a coordenada X (flip)

    //   positionAttr.array[i * 3] = x;
    //   positionAttr.array[i * 3 + 1] = y;
    //   positionAttr.array[i * 3 + 2] = z;

    // //   console.log({z});
    // }
    // positionAttr.needsUpdate = true;

    // Atualiza os pontos no BufferGeometry
    for (let i = 0; i < smoothLandmarks.length; i++) {
        let x = (smoothLandmarks[i].x - 0.5) * scale;  // de 0-1 para -1 a 1
        let y = -(smoothLandmarks[i].y - 0.5) * scale; // inverte o eixo y
        let z = smoothLandmarks[i].z * scale;
        x = -x; // Inverte a coordenada X para o efeito desejado

        positionAttr.array[i * 3]     = x;
        positionAttr.array[i * 3 + 1] = y;
        positionAttr.array[i * 3 + 2] = z;

    }
    positionAttr.needsUpdate = true;
    
    // Armazena os pontos atuais para a próxima iteração
    hand.prevLandmarks = smoothLandmarks;

    

    // Atualiza SkinnedMesh (se houver bones associados)
    if (Game.players[0].mesh.hands.bones && label === "Right") {

        updateHandSkeletonFromLandmarks(Game.players[0].mesh.hands.bones, smoothLandmarks, Game.players[0].mesh.hands.model);
    }
    
    
}

// Função para atualizar a posição das mãos
function updateHandPosition(handMesh, landmarks, results, radius) {
    // Mapeando as coordenadas normalizadas (0-1) para o sistema de coordenadas 3D do Three.js
    const wrist = landmarks[0]; // Ponto do pulso, por exemplo

    // Normalizando para o espaço de coordenadas 3D do Three.js (ajustando conforme necessário)
    let x = wrist.x * 2 - 1; // Convertendo de 0-1 para -1 a 1 (para o eixo X)
    const y = -(wrist.y * 2 - 1); // Convertendo de 0-1 para -1 a 1 (para o eixo Y) e invertendo para ajustar a direção
    let z = (wrist.z * radius - 1); // Ajustando a profundidade (z) dependendo do modelo, mas pode ser necessário um ajuste adicional
    // Aplica o flip horizontal diretamente na coordenada x
    x = -x; // Inverte a coordenada X (flip)
    z = z * 1;

    if (results && results.landmarks && results.handednesses.length > 0) {
        // Atualiza cada mão detectada
        results.landmarks.forEach((landmarks, i) => {
            const label = results.handednesses?.[i]?.[0]?.categoryName;
            const origem = {x:0, y:0, z:-1.5};
            if (label === "Left") {
                const handObj = Game.players[0].mesh.hands.left;
                handObj.pointsMesh.position.set(origem.x, origem.y, origem.z);
                updatePoints(handObj, landmarks, label);
                // updateEdges(handObj, landmarks);
            
            } else if (label === "Right") {
                const handObj = Game.players[0].mesh.hands.right;
                handObj.pointsMesh.position.set(origem.x, origem.y, origem.z);
                updatePoints(handObj, landmarks, label);
                // updateEdges(handObj, landmarks);
            }
        });
      }



}
  
async function detectLoop() {

    if(typeof _loopDebugger0 == 'undefined'){
        window._loopDebugger0 = true;
        DEBUGGER && console.log("[detectLoop]", Game);
    }
    
    requestAnimationFrame(detectLoop);
    frameCounter++;

    // Processa somente a cada 2 frames
    if (frameCounter % 2 !== 0) return;

    if (video.readyState >= 2 && handLandmarker) {
        const now = performance.now();
        const results = handLandmarker.detectForVideo(video, now);
    
        // Ajusta o canvas ao tamanho do vídeo
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Agora desenha os landmarks com a rotação aplicada ao canvas
        if (results.landmarks && results.landmarks.length > 0) {

            Game.players[0].resultDetectForVideo = results;

            results.landmarks.forEach((landmarks, i) => {
                const handLabel = results.handednesses?.[i]?.[0]?.categoryName || "Unknown";
                const handIndex = results.handednesses?.[i]?.[0]?.index || 0;
                const color = handLabel === "Left" ? "blue" : "green";

                drawPointsCanvas(landmarks, overlayCanvas, ctx, color, handLabel);

                if(handLabel === "Left") {
                    updateHandPosition(Game.players[0].mesh.rightHand, landmarks, results, radius);
                }

                if(handLabel === "Right") {
                    updateHandPosition(Game.players[0].mesh.leftHand, landmarks, results, radius);
                }
                
            });
        }    
    }
    
}

function drawPointsCanvas(landmarks, overlayCanvas, ctx, color, label) {
    let arrayIndexOrder = [0, 4,  8,  20, 5, 17];
    let areaIndex = [];

    landmarks.forEach((point, i) => {
        // Aplica rotação nos pontos individuais
        const rotated = rotate3D(point, { pitch: 0 * (Math.PI / 180), yaw: 0, roll: 0 });

        // Corrige inversão horizontal
        const mirroredX = 1.0 - rotated.x;

        // Escala e posiciona na tela com perspectiva (opcional, mas você pode manter)
        const x = mirroredX * overlayCanvas.width;
        const y = rotated.y * overlayCanvas.height;
        // const z = rotated.z * overlayCanvas.height;

        // Manipula o valor de z para simular profundidade
        let z = point.z * overlayCanvas.height;

        // Inverte o comportamento de z: diminui se o novo valor for maior, aumenta se o novo valor for menor
        z = (z < previousZ) ? z + 5 : z - 5;

        // Atualiza o valor de z para a próxima iteração
        previousZ = z;

        // Agora usamos z para alterar o tamanho do ponto (simulando profundidade)
        let radius = 10 + (z / 50); // Ajusta o tamanho do ponto com base em z (quanto maior o z, maior o ponto)

        // radius = Math.max(0, radius);
        // radius = (point.z * overlayCanvas.height);
        // radius = (radius < 0 ? 0 : radius) * 10000;
        // radius = (radius + 2) > 10 ? 10 : radius + 2;
        radius = 6;


        // Desenha o ponto na tela
        ctx.beginPath();
        const flippedX = overlayCanvas.width - point.x.toFixed(4) * overlayCanvas.width;
        ctx.arc(flippedX, point.y.toFixed(4) * overlayCanvas.height, radius, 0, 2 * Math.PI);
        ctx.fillStyle = arrayIndexOrder.includes(i) ? "yellow" : color;
        ctx.fill();
        ctx.closePath(); // Fecha o caminho

  

  
        

        if(arrayIndexOrder.includes(i)) {
            // Desenha cada coordenada com uma cor diferente
            const xText = `${(x / overlayCanvas.width).toFixed(2)}`;
            const yText = `${(y / overlayCanvas.height).toFixed(2)}`;
            const zText = `${((point.z * overlayCanvas.height) * 1000).toFixed(2)}`;

       
        
            // Cor para o x
            ctx.fillStyle = '#33ff05';        
            ctx.fillText(xText, x, y);
            
            // Cor para o y
            ctx.fillStyle = 'red';
            ctx.fillText(yText, x + ctx.measureText(xText).width + 5, y);  // Posição ajustada para o próximo valor
        
            // Cor para o z
            ctx.fillStyle = 'blue';
            ctx.fillText(zText, x + ctx.measureText(xText).width + ctx.measureText(yText).width + 10, y);  // Posição ajustada
            ctx.fillStyle = 'white';
          

            areaIndex[areaIndex.length] = [x, y, parseFloat(zText), i];
            areaIndex = areaIndex.filter(item => item !== null);

            
            // Posicionamento e desenhando o texto
            if (areaIndex.length === 6) {

                areaIndex.sort((a, b) => {
                    const indexA = arrayIndexOrder.indexOf(a[3]);
                    const indexB = arrayIndexOrder.indexOf(b[3]);
                    return indexA - indexB;
                });

                areaIndex.forEach((coords, i) => {
                    // Calcula a posição vertical com base no índice
                    const offsetY = (y / overlayCanvas.height) + 20 + (i * 10);
                
                    // Formata as coordenadas
                    const formattedText = formatCoordinates(coords);

                    // Desenha o texto na posição calculada
                    ctx.fillText(formattedText, (x / overlayCanvas.width) + 20, offsetY);
                });

                // Ligando as coordenadas com linhas
                ctx.beginPath();
                
                ctx.moveTo(areaIndex[0][0], areaIndex[0][1] );  // Posição inicial 0
                ctx.lineTo(areaIndex[1][0], areaIndex[1][1] );  // Posição final 4
                ctx.moveTo(areaIndex[1][0], areaIndex[1][1] );  // Posição inicial 4
                ctx.lineTo(areaIndex[2][0], areaIndex[2][1] );  // Posição final 8
                ctx.moveTo(areaIndex[2][0], areaIndex[2][1] );  // Posição inicial 8
                ctx.lineTo(areaIndex[3][0], areaIndex[3][1] );  // Posição final 20
                ctx.moveTo(areaIndex[3][0], areaIndex[3][1] );  // Posição inicial 20
                ctx.lineTo(areaIndex[0][0], areaIndex[0][1] );  // Posição final 0
                ctx.strokeStyle = 'green';  // Cor da linha
              
           
                ctx.lineWidth = 5; 
                ctx.stroke();
                ctx.closePath();  // Fecha o caminho da linha

                ctx.beginPath();
                ctx.strokeStyle = 'red';
                ctx.moveTo(areaIndex[4][0], areaIndex[4][1] );  // Posição inicial 5
                ctx.lineTo(areaIndex[5][0], areaIndex[5][1] );  // Posição final 17
                ctx.stroke();
                ctx.closePath();  // Fecha o caminho da linha

                ctx.beginPath();
                ctx.moveTo(areaIndex[5][0], areaIndex[5][1] );  // Posição final 17
                ctx.lineTo(areaIndex[0][0], areaIndex[0][1] );  // Posição final 0

                ctx.moveTo(areaIndex[5][0], areaIndex[5][1] );  // Posição final 17
                ctx.lineTo(areaIndex[3][0], areaIndex[3][1] );  // Posição inicial 20

                ctx.moveTo(areaIndex[4][0], areaIndex[4][1] );  // Posição inicial 5
                ctx.lineTo(areaIndex[1][0], areaIndex[1][1] );  // Posição final 4

                ctx.moveTo(areaIndex[4][0], areaIndex[4][1] );  // Posição inicial 5
                ctx.lineTo(areaIndex[2][0], areaIndex[2][1] );  // Posição final 8
        
            

                ctx.strokeStyle = 'blue';  // Cor da linha
                ctx.stroke();
                ctx.closePath();  // Fecha o caminho da linha


                // console.log(direcaoEntreVetores({x: areaIndex[1][0], y: areaIndex[1][1], z: areaIndex[1][2]}, {x: areaIndex[2][0], y: areaIndex[2][1], z: areaIndex[2][2]}));
                // console.log(anguloEntreVetores({x: areaIndex[1][0], y: areaIndex[1][1], z: areaIndex[1][2]}, {x: areaIndex[2][0], y: areaIndex[2][1], z: areaIndex[2][2]}));
                // console.log(distancia({x: areaIndex[1][0], y: areaIndex[1][1], z: areaIndex[1][2]}, {x: areaIndex[2][0], y: areaIndex[2][1], z: areaIndex[2][2]}));

                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
            

       

                let x_ = ((areaIndex[1][0] / overlayCanvas.width)  - (areaIndex[2][0] / overlayCanvas.width)).toFixed(2);
                let y_ = ((areaIndex[1][1] / overlayCanvas.height)  - (areaIndex[2][1] / overlayCanvas.height)).toFixed(2);
           
                // ctx.fillText(`${distanciaEntreVetores({
                //         x: areaIndex[1][0] / overlayCanvas.width, 
                //         y: areaIndex[1][1] / overlayCanvas.height, 
                //         z:  0//(areaIndex[1][2] * overlayCanvas.height) * 1000
                //     }, 
                //     {
                //         x: areaIndex[2][0] / overlayCanvas.width, 
                //         y: areaIndex[2][1] / overlayCanvas.height, 
                //         z: 0//(areaIndex[2][2] * overlayCanvas.height) * 1000
                //     }) 
                // }`, areaIndex[1][0] + 20 , areaIndex[1][1] + 20);  // Posição ajustada para o próximo valor

                let t_ = tamanhoReta({x: areaIndex[4][0] , y: areaIndex[4][1] , z: 0}, {x: areaIndex[5][0] , y: areaIndex[5][1] , z: 0})
                ctx.fillText(`${ (t_ / overlayCanvas.height).toFixed(2) }`, areaIndex[4][0] + 20 , ((areaIndex[4][1] + areaIndex[5][1]) / 2) );  // Posição ajustada para o próximo valor


                const raio = calcularRaio( {x: areaIndex[4][0] , y: areaIndex[4][1] , z: 0}, {x: areaIndex[5][0] , y: areaIndex[5][1] , z: 0} );
                const ang = anguloReta( {x: areaIndex[5][0] , y: areaIndex[5][1] , z: 0}, {x: areaIndex[4][0] , y: areaIndex[4][1] , z: 0} ) ; // flip angulo
                ctx.beginPath();
                ctx.arc(areaIndex[4][0], areaIndex[4][1], raio, 0, 2 * Math.PI);
                ctx.font = '12px Arial';
                ctx.fillText(`${ ang.toFixed(2) }°`, areaIndex[4][0] - 30 , areaIndex[4][1] + 20 );  // Posição ajustada para o próximo valor
                ctx.strokeStyle = 'red';
                ctx.stroke();
                ctx.closePath();
                 
            }

       
 
        }
  
    });
}


/**
 * Calcula o ângulo (em graus) da reta formada por dois pontos 2D
 * @param {{x: number, y: number}} p1 - ponto de origem
 * @param {{x: number, y: number}} p2 - ponto de destino
 * @returns {number} Ângulo em graus
 */
function anguloReta(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const rad = Math.atan2(dy, dx); // ângulo em radianos  [-π, π]
    const deg = rad * (180 / Math.PI); // convertendo para graus
    return deg;
  }

  // Função que calcula o comprimento da reta (raio)
  function calcularRaio(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

/**
 * Calcula o comprimento de uma reta entre dois pontos (2D ou 3D)
 * @param {{x: number, y: number, z?: number}} p1 - ponto inicial
 * @param {{x: number, y: number, z?: number}} p2 - ponto final
 * @returns {number} Comprimento da reta
 */
function tamanhoReta(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = (p2.z || 0) - (p1.z || 0); // caso não tenha z, assume 0
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calcula o tamanho (magnitude) de um vetor 3D
 * @param {{x: number, y: number, z: number}} v
 * @returns {number} Tamanho (norma) do vetor
 */
function tamanhoVetor(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}


/**
 * Calcula a distância entre dois vetores 3D (pontos no espaço)
 * @param {{x: number, y: number, z: number}} v1
 * @param {{x: number, y: number, z: number}} v2
 * @returns {number} Distância entre v1 e v2
 */
function distanciaEntreVetores(v1, v2) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dz = v2.z - v1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calcula o vetor direção entre dois pontos no espaço 3D
 * @param {{x: number, y: number, z: number}} v1 - Vetor de origem
 * @param {{x: number, y: number, z: number}} v2 - Vetor de destino
 * @returns {{x: number, y: number, z: number}} - Vetor direção normalizado
 */
function direcaoEntreVetores(v1, v2) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dz = v2.z - v1.z;
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
    return {
      x: dx / magnitude,
      y: dy / magnitude,
      z: dz / magnitude
    };
}
  
  
/**
 * Calcula o ângulo (em radianos) entre dois vetores 3D
 * @param {{x: number, y: number, z: number}} v1
 * @param {{x: number, y: number, z: number}} v2
 * @returns {number} Ângulo em radianos
 */
function anguloEntreVetores(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2);
    const mag2 = Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2);

    return Math.acos(dot / (mag1 * mag2)); // resultado em radianos
}

/**
 * Calcula o produto vetorial entre dois vetores 3D
 * @param {{x: number, y: number, z: number}} v1
 * @param {{x: number, y: number, z: number}} v2
 * @returns {{x: number, y: number, z: number}} Vetor perpendicular (sentido)
 */
function produtoVetorial(v1, v2) {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
}

// Função para formatar as coordenadas X, Y, Z
const formatCoordinates = (coords) => {
    return coords.map((item, i) => {
        switch (i) {
            case 0:
                return `X: ${(item / overlayCanvas.width).toFixed(2)}`;
            case 1:
                return `Y: ${(item / overlayCanvas.height).toFixed(2)}`;
            default:
                return `Z: ${item.toFixed(2)}`;
        }
    }).join(', ');
};

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

function uploadGLTF(event){
    console.log("[uploadGLTF]");
    
    const loader = new GLTFLoader();
    let handModel;
    
    loader.load('/static/models/character.glb', (gltf) => {
        handModel = gltf.scene;
        handModel.scale.set(8, 8, 8);
        handModel.position.set(0, 0, -1.5); // um pouco abaixo e à frente da visão
        handModel.rotation.set(
            THREE.MathUtils.degToRad(-90), // pitch
            THREE.MathUtils.degToRad(0), // yaw 
            THREE.MathUtils.degToRad(150) // roll
        );
        const axesHelper = new THREE.AxesHelper(1);
        handModel.add(axesHelper);
          // 👉 Adiciona na cena (visualmente)
        // Game.scene.add(handModel);

        // Rotaciona se estiver de costas
        // handModel.rotation.y = Math.PI; // Gira 180° se estiver de costas

        Game.camera.add(handModel); // Para manter sempre visível
        // handModel.position.set(0, 1, -1); // Em relação à câmera
        console.log({handModel});
    

        handBonesRight = {};
        gltf.scene.traverse((obj) => {
            if (obj.isBone) {
                handBonesRight[obj.name] = obj;
            }
        });




        const bones = getBonesFromModel(handModel);
        Game.players[0].mesh.hands.model = handModel;
        Game.players[0].mesh.hands.bones = bones;

        // const helper = new THREE.AxesHelper(0.2);
        // Game.players[0].mesh.hands.model.add(helper);


      

    }, undefined, (error) => {
      console.error('Erro ao carregar o modelo da mão:', error);
    });


    
}

/**
 * Inverte valor dentro do intervalo de 0 a 10
 * @param {number} valorAtual - valor de 0 a 10
 * @returns {number} valor invertido (espelhado)
 */
function inverterCrescimento(valorAtual, min = 0, max = 0.20) {

    if(valorAtual == min) return 0;
    return max - (valorAtual - min);
}

  /**
 * Escala um valor de um intervalo para outro
 * @param {number} valor - o valor que será escalado
 * @param {number} deMin - valor mínimo original
 * @param {number} deMax - valor máximo original
 * @param {number} paraMin - valor mínimo do novo intervalo
 * @param {number} paraMax - valor máximo do novo intervalo
 * @returns {number} valor escalado para o novo intervalo
 */
function escalarValor(valor, deMin, deMax, paraMin, paraMax) {
    const proporcao = (valor - deMin) / (deMax - deMin);
    return paraMin + proporcao * (paraMax - paraMin);
}

function updateHandSkeletonFromLandmarks(bones, landmarks, model, boneMap = boneMapRight, scale = 4) {


    if (!bones || !landmarks || landmarks.length !== 21) return;

    if(typeof _loopDebugger1 == 'undefined'){
        window._loopDebugger1 = true;
        DEBUGGER && console.log("[updateHandSkeletonFromLandmarks]", handBonesRight);
    }

    
    // 🟢 1. Base: posição do pulso (landmark 0)
    const wrist = landmarks[0];
    const wristPos = new THREE.Vector3(
      (1.0 - wrist.x - 0.5) * scale,
      -(wrist.y - 0.5) * scale,
      wrist.z * scale
    );


    
  
    // 🔧 2. Aplica offset de posição (para ajustar onde a mão aparece na cena)
    const positionOffset = new THREE.Vector3(0, 0, -2.0); // ajuste fino para visão em 1ª pessoa
    const adjustedPos = wristPos.clone().add(positionOffset);
    model.position.copy(adjustedPos);


    // let s = calcularRaio( landmarks[5], landmarks[17] );
    // let i = inverterCrescimento(s);
    // s = escalarValor(i, 0,0.10, 6, 9);
    // console.log({s, i});
    // model.scale.set(s, s, s);


    
    // 🔄 3. Calcula rotação automática com base nos landmarks da palma
    const indexBase = new THREE.Vector3(
      (1.0 - landmarks[5].x - 0.5) * scale,
      -(landmarks[5].y - 0.5) * scale,
      landmarks[5].z * scale
    );

    const pinkyBase = new THREE.Vector3(
      (1.0 - landmarks[17].x - 0.5) * scale,
      -(landmarks[17].y - 0.5) * scale,
      landmarks[17].z * scale
    );

    const xAxis = new THREE.Vector3().subVectors(indexBase, pinkyBase).normalize();
    const zAxis = new THREE.Vector3().subVectors(
      new THREE.Vector3().addVectors(indexBase, pinkyBase).multiplyScalar(0.5),
      wristPos
    ).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize(); // reortogonaliza
  
    const rotationMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const baseQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
  
    // 🛠️ 4. Aplica offset de rotação (ajuste visual manual)
    const manualEulerOffset = new THREE.Euler(
      THREE.MathUtils.degToRad(0),  // X - inclina a palma pra baixo
      THREE.MathUtils.degToRad(25), // Y - vira a palma pra frente
      THREE.MathUtils.degToRad(190)   // Z - leve inclinação lateral
    );
    const offsetQuaternion = new THREE.Quaternion().setFromEuler(manualEulerOffset);
  
    // Combina a rotação automática com o offset manual
    baseQuaternion.multiply(offsetQuaternion);
  
    // Aplica rotação suavizada ao modelo
    model.quaternion.slerp(baseQuaternion, 0.6);
    

  
 
    /*
    // 🦴 5. Atualiza os bones dos dedos com rotação entre landmarks
    for (const [i, boneName] of Object.entries(boneMap)) {
      const index = parseInt(i);
      const nextIndex = index + 1;
  
      const bone = bones[boneName];
      if (!bone) continue;
  
      const point = landmarks[index];
      const pointNext = landmarks[nextIndex] || point;
  
      const fromVec = new THREE.Vector3(
        (1.0 - point.x - 0.5) * scale,
        -(point.y - 0.5) * scale,
        point.z * scale
      );
  
      const toVec = new THREE.Vector3(
        (1.0 - pointNext.x - 0.5) * scale,
        -(pointNext.y - 0.5) * scale,
        pointNext.z * scale
      );
  
      const direction = new THREE.Vector3().subVectors(toVec, fromVec).normalize();
      const up = new THREE.Vector3(0, 1, 0); // eixo padrão dos bones no Mixamo
      const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
      bone.quaternion.slerp(quat, 0.8);



 
    }
    */

    // 🔁 Rotação baseada em landmarks[5] → [6]
    const bone = bones['mixamorigLeftHandIndex1'];
    if (bone && landmarks[5] && landmarks[6] && true) {
        const scale = 4; // ou o que estiver sendo usado na sua função

        let fromVec = new THREE.Vector3(
            (0.5 - flipX(landmarks[0]).x) * scale,  // Flip X
            -(landmarks[0].y - 0.5) * scale,
            landmarks[0].z * scale
        );



        let toVec = new THREE.Vector3(
            (0.5 - flipX(landmarks[8]).x) * scale,
            -(landmarks[8].y - 0.5) * scale,
            landmarks[8].z * scale
        );

        // console.log({wrist: `x:${fromVec.x.toFixed(2)} y:${fromVec.y.toFixed(2)} z:${fromVec.z.toFixed(8)} -x:${toVec.x.toFixed(2)} y:${toVec.y.toFixed(2)} z:${toVec.z.toFixed(8)} - `});
        // console.log(`dis: ${ (distancia(fromVec, toVec).toFixed(2) )  }, ${Math.sin(Date.now() * 0.001) * 0.4}`);
        // console.log(`dis: ${distancia(fromVec, toVec)}`);
        
        if(distancia(fromVec, toVec) < 1.5){
            bone.rotation.x = 2;//Math.sin(Date.now() * 0.001) * 0.4; 
        }else{
            bone.rotation.x = 0;
        }
       

      

        // const direction = new THREE.Vector3().subVectors(toVec, fromVec).normalize();
        // const boneUp = new THREE.Vector3(0, 1, 0); // Eixo padrão Mixamo

        // const rotation = new THREE.Quaternion().setFromUnitVectors(boneUp, direction);

        // // console.log({rotation});
        // // bone.quaternion.slerp(rotation, 0.8); // Suaviza a rotação

        // bone.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3().subVectors(new THREE.Vector3(handRotationOffset.x, handRotationOffset.y, handRotationOffset.z), landmarks[6]).normalize(), direction), 0.8);
    }

 
    return
      // 🔁 Rotação baseada em landmarks[5] → [6]
      const bone8 = bones['mixamorigLeftHandIndex4'];
      if (bone && landmarks[7] && landmarks[8] && false) {
          const scale = 4; // ou o que estiver sendo usado na sua função
  
          const fromVec = new THREE.Vector3(
              (0.5 - landmarks[7].x) * scale,  // Flip X
              -(landmarks[7].y - 0.5) * scale,
              landmarks[7].z * scale
          );
  
          const toVec = new THREE.Vector3(
              (0.5 - landmarks[8].x) * scale,
              -(landmarks[8].y - 0.5) * scale,
              landmarks[8].z * scale
          );
  
          const direction = new THREE.Vector3().subVectors(toVec, fromVec).normalize();
          const boneUp = new THREE.Vector3(0, 1, 0); // Eixo padrão Mixamo
  
          const rotation = new THREE.Quaternion().setFromUnitVectors(boneUp, direction);
          bone.quaternion.slerp(rotation, 0.8); // Suaviza a rotação
      }
  
    model.updateMatrixWorld(true);

}

/**
 * Calcula a distância Euclidiana entre dois vetores 3D.
 * @param {{x: number, y: number, z: number}} a 
 * @param {{x: number, y: number, z: number}} b 
 * @returns {number}
 * @example
 * const a = {x: 1, y: 2, z: 0};
 * const b = {x: 4, y: 6, z: 3};
 * console.log(distancia(a, b)); // ~5.830
 */
function distancia(a, b) {
    let soma = 0;
    for (const chave in a) {
      if (b.hasOwnProperty(chave)) {
        const diff = a[chave] - b[chave];
        soma += diff * diff;
      }
    }
    return Math.sqrt(soma);
}

/**
 * Mapeia um valor de um intervalo para outro.
 * @param {number} valor - Valor original.
 * @param {number} deMin - Mínimo do intervalo original.
 * @param {number} deMax - Máximo do intervalo original.
 * @param {number} paraMin - Mínimo do novo intervalo.
 * @param {number} paraMax - Máximo do novo intervalo.
 * @returns {number} - Valor mapeado.
 * @example
 * const resultado = remapear(0.35, 0.35, 0.40, -0.3, 2); // -0.3
 */
function remapear(valor, deMin, deMax, paraMin, paraMax) {
    return ((valor - deMin) * (paraMax - paraMin)) / (deMax - deMin) + paraMin;
  }

function flipX(point, scale = 4) {
    return new THREE.Vector3(
      (0.5 - point.x) * scale,
      -(point.y - 0.5) * scale,
      point.z * scale
    );
}

/**
 * Aplica flip no eixo Y para um ponto normalizado.
 * @param {{x: number, y: number, z: number}} point - O ponto original do MediaPipe (0 a 1)
 * @returns {{x: number, y: number, z: number}} - Ponto com Y invertido
 */
function flipY(point) {
    return {
      x: point.x,
      y: 1.0 - point.y,
      z: point.z
    };
}

function getBonesFromModel(model) {
    const bones = {};

    // model.traverse((obj) => {
    //     if (obj.isBone) {
    //       const label = createBoneLabel(obj.name);
    //       obj.add(label); // anexa à posição do bone
    //       label.position.set(0, 0.1, -1); // ajusta se necessário
    //     }
    // });

    model.traverse((child) => {

        // console.log({child});
        

        // if (child.isMesh && (child.name === 'alpha_surface' || child.name === 'alpha_joints')) {
        //     child.visible = false;
        // }

        // if (child.isMesh) {
        //     const name = child.name.toLowerCase();
        //     const isHand = name.includes('Hand') || name.includes('wrist');
        //     child.visible = isHand; // deixa visível apenas as partes da mão
        // }

        if (child.isBone) {
            bones[child.name] = child;
        }
    });
    return bones;
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

    if (Game.scene && Game.camera && Game.renderer) {
        Game.renderer.render(Game.scene, Game.camera);
    }
    
}

await bootstrap();

Game.renderer.setAnimationLoop(animate);

window.addEventListener('DOMContentLoaded', handlerKeysTouch);
window.addEventListener('resize', handlerResize);
document.addEventListener("touchstart", handlertouchstart);
document.addEventListener("touchmove", handlerTouchmove);
window.addEventListener("devicemotion", handlerDevicemotion, true);

