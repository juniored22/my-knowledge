
// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";

import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';
import { OrbitControls } from '/static/modules/OrbitControls.js'; // <-- arquivo local
import { OBJLoader } from '/static/modules/OBJLoader.js'; // <-- arquivo local
import { TRIANGULATION } from "/static/shared/triangulation.js";

// FaceLandmarker	Detecta pontos da face, íris, sobrancelhas, lábios etc.
// FilesetResolver	Carrega os arquivos .wasm e resolve paths
// DrawingUtils	Ferramentas para desenhar os pontos no canvas
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;



// Índices dos pontos dos olhos (referência do MediaPipe)
const RIGHT_EYE = FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE.map(({ start }) => start);
const LEFT_EYE = FaceLandmarker.FACE_LANDMARKS_LEFT_EYE.map(({ start }) => start);
const RIGHT_IRIS = FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS.map(({ start }) => start);
const LEFT_IRIS = FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS.map(({ start }) => start);

const RIGHT_IRIS_IDX = FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS.map(({ start }) => start);
const LEFT_IRIS_IDX = FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS.map(({ start }) => start);



// Junta tudo
const EYE_POINTS = new Set([
//   ...RIGHT_EYE,
//   ...LEFT_EYE,
//   ...RIGHT_IRIS,
//   ...LEFT_IRIS
]);

const LEFT_EYE_POINTS = new Set([...LEFT_EYE, ...LEFT_IRIS]);
const RIGHT_EYE_POINTS = new Set([...RIGHT_EYE, ...RIGHT_IRIS]);

const BASE_TRIANGLES = [];
const LEFT_EYE_TRIANGLES = [];
const RIGHT_EYE_TRIANGLES = [];

for (let i = 0; i < TRIANGULATION.length; i += 3) {
    const a = TRIANGULATION[i];
    const b = TRIANGULATION[i + 1];
    const c = TRIANGULATION[i + 2];

    const inLeft = LEFT_EYE_POINTS.has(a) || LEFT_EYE_POINTS.has(b) || LEFT_EYE_POINTS.has(c);
    const inRight = RIGHT_EYE_POINTS.has(a) || RIGHT_EYE_POINTS.has(b) || RIGHT_EYE_POINTS.has(c);

    if (inLeft && !inRight) {
        LEFT_EYE_TRIANGLES.push(a, b, c);
    } else if (inRight && !inLeft) {
        RIGHT_EYE_TRIANGLES.push(a, b, c);
    } else if (!inLeft && !inRight) {
        BASE_TRIANGLES.push(a, b, c);
    }
}


// TRIANGULATION é um array flat: [a, b, c, a, b, c, ...]
const filteredTriangles = [];

for (let i = 0; i < TRIANGULATION.length; i += 3) {
    const a = TRIANGULATION[i];
    const b = TRIANGULATION[i + 1];
    const c = TRIANGULATION[i + 2];

    // Se nenhum dos 3 pontos está nos olhos, então mantenha
    if (!EYE_POINTS.has(a) && !EYE_POINTS.has(b) && !EYE_POINTS.has(c)) {
        filteredTriangles.push(a, b, c);
    }
}

const EAR_HISTORY = {
    left: [],
    right: [],
    maxFrames: 3
};



const demosSection = document.getElementById("demos");
const videoBlendShapes = document.getElementById("video-blend-shapes");
const webcamButton = document.getElementById("webcamButton");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const faceCanvas = document.getElementById("face_canvas");
const faceCtx = faceCanvas.getContext("2d");
const webcamCanvas = document.getElementById("webcam_canvas");
const webcamCtx = webcamCanvas.getContext("2d");
const mouthCanvas = document.getElementById("mouthCanvas");
const mouthCtx = mouthCanvas.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);
const videoWidth = 480;
const maxRecordingTimeMs = 10000;
const vertexLabels = [];
const getUserMediaWidthHeight = { x: 640, y: 480 }


let faceLandmarker;
let runningMode = "IMAGE"; 
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
let faceGeometry = null;
let faceMesh = null;
let irisRightMesh = null;
let irisLeftMesh = null;
let eyeFacesRemoved = true; // já começamos com olhos ocultos
let face_Landmarkers_contours_color = "#575555A3";
let faceGroup = null;

const record = {
    bRecording:false,
    iRecordingStart:0,
    vLandmarkFrames:[]
}

const mouse = {
    rotationY:0,
    rotationX:0,
    isDragging:false,
    lastMouseX:0,
    lastMouseY:0
}

const game = {
    scene: null,
    wireframe:true,
    camera:null
}


function setRecording(record, value){
    record.bRecording = value;
    record.iRecordingStart = performance.now();
    record.vLandmarkFrames = [];
}

function disabledButtons(value){
    document.getElementById("recordBtn").disabled = value
    document.getElementById("webcamButton").disabled = value
}

function startRecord(record, event){
    disabledButtons(true);
    setRecording(record, true)
    console.log("🎥 Gravando landmarks por 5 segundos...");
}

function handlerMouseup(mouse, event){
    mouse.isDragging = false;
}

function handlerMousedown(mouse, event){
    mouse.isDragging = true;
    mouse.lastMouseX = event.clientX;
    mouse.lastMouseY = event.clientY;
}

function handlerMousemove(mouse, event){
    if (!mouse.isDragging) return;

    const deltaX = event.clientX - mouse.lastMouseX;
    const deltaY = event.clientY - mouse.lastMouseY;
    mouse.lastMouseX = event.clientX;
    mouse.lastMouseY = event.clientY;
  
    mouse.rotationY += deltaX * 0.005; // lateral = rotação Y
    mouse.rotationX += deltaY * 0.005; // vertical = rotação X
  
    // Limita para não virar de cabeça pra baixo
    mouse.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouse.rotationX));
}

function addStyleActioveFaceCanvas(canvas, event){
    canvas.faceCanvas.classList.toggle('face_canva_webcam_background');
    canvas.canvasElement.classList.toggle('background_transparent');

    face_Landmarkers_contours_color = face_Landmarkers_contours_color == "#158d25"
    ? face_Landmarkers_contours_color = "#575555A3" 
    : face_Landmarkers_contours_color ="#158d25"
    
    
}

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function toggleWebcam() {
    if (!faceLandmarker) return console.log("FaceLandmarker não carregado ainda.");
    webcamRunning = !webcamRunning;
    webcamButton.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

    if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: {
                facingMode: { ideal: "user" }, // "environment" ou "user"
                width: { ideal: getUserMediaWidthHeight.x },               // largura desejada
                height: { ideal: getUserMediaWidthHeight.y }                // altura desejada
            },
         }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        if(!game.scene) threeFaceMash();
        
    });
    }
}

async function predictWebcam() {
    const aspectRatio = video.videoHeight / video.videoWidth;
    Object.assign(video.style, { width: `${videoWidth}px`, height: `${videoWidth * aspectRatio}px` });
    // Object.assign(canvasElement.style, { width: `${videoWidth}px`, height: `${videoWidth * aspectRatio}px` });
    // canvasElement.width = video.videoWidth;
    // canvasElement.height = video.videoHeight;

    canvasElement.width = document.querySelector('#webcam').width
    canvasElement.height = document.querySelector('#webcam').height;
    webcamCanvas.width = document.querySelector('#webcam').width
    webcamCanvas.height = document.querySelector('#webcam').height;
    

    


    if (runningMode !== "VIDEO") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode });
    }

    const startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, startTimeMs);
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.faceLandmarks) {        
        results.faceLandmarks.forEach((landmarks) => drawLandmarks(drawingUtils, landmarks));
    }

    drawBlendShapes(videoBlendShapes, results.faceBlendshapes);

    if (webcamRunning) {
        requestAnimationFrame(predictWebcam);
    }

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {

        const landmarks = results.faceLandmarks[0];
    
        // Extrai os pontos dos pares {start, end}
        const selectedPoints = [];

        FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(({ start, end }) => {
            const p1 = landmarks[start];
            const p2 = landmarks[end];
            if (p1 && p2) {
                selectedPoints.push(p1, p2);
            }
        });

       
    
        const xs = selectedPoints.map(p => p.x * video.videoWidth);
        const ys = selectedPoints.map(p => p.y * video.videoHeight);
        
        const minX = Math.max(Math.min(...xs), 0);
        const maxX = Math.min(Math.max(...xs), video.videoWidth);
        const minY = Math.max(Math.min(...ys), 0);
        const maxY = Math.min(Math.max(...ys), video.videoHeight);
        
        const width = maxX - minX;
        const height = maxY - minY;

        webcamCtx.width = video.videoWidth;
        webcamCtx.height = video.videoHeight;
        
        faceCanvas.width = width;
        faceCanvas.height = height;
        
        faceCtx.clearRect(0, 0, width, height);
        faceCtx.save();
        faceCtx.scale(-1, 1);
        faceCtx.translate(-faceCanvas.width, 0);

        // Desenhar o recorte espelhado
        faceCtx.drawImage(video, minX, minY, width, height, 0, 0, width, height);
        faceCtx.restore();

        webcamCtx.save();
        webcamCtx.scale(-1, 1); // espelha se necessário
        webcamCtx.translate(-webcamCanvas.width, 0);
        webcamCtx.drawImage(video, 0, 0, webcamCanvas.width, webcamCanvas.height);
        webcamCtx.restore();

     

    }

    if (record.bRecording && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const now = performance.now();
        if (now - record.iRecordingStart < maxRecordingTimeMs) {
            // Clona os landmarks do frame atual
            const landmarksCopy = structuredClone(results.faceLandmarks[0]);
            record.vLandmarkFrames.push(landmarksCopy);
        } else {
            record.bRecording = false;
            console.log("🛑 Gravação finalizada! Frames capturados:", record.vLandmarkFrames.length);
            toggleWebcam();
            setTimeout(playbackLandmarks, 1000); // espera 1s e toca a animação
        }
    }

    if (true && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Recorta a imagem da boca usando os landmarks
        extractRegion(video, landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, mouthCanvas, mouthCtx);
    }

    if (faceGeometry && results.faceBlendshapes?.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
    

        const threshold = 0.02;
        const landmarks = results.faceLandmarks[0];

        // EAR baseado nos melhores pontos conhecidos
        const rightEAR = getEAR(landmarks, RIGHT_EYE);
        const leftEAR = getEAR(landmarks, LEFT_EYE);


        
        updateEARHistory("left", leftEAR);
        updateEARHistory("right", rightEAR);
        
        // const leftEyeClosed = isEyeClosedFromHistory("left", threshold);
        // const rightEyeClosed = isEyeClosedFromHistory("right", threshold);

        const leftEyeClosed = isEyeClosedByPoints(landmarks, 145, 159, threshold);
        const rightEyeClosed = isEyeClosedByPoints(landmarks, 380, 385, threshold);

        

        // console.log(`159: (x=${results.faceLandmarks[0][159].x}, y=${results.faceLandmarks[0][159].y})`);
        // console.log(`145: (x=${results.faceLandmarks[0][145].x}, y=${results.faceLandmarks[0][145].y})`);
        // const distY = Math.abs(landmarks[380].y - landmarks[385].y);
        // console.log("Distância Y entre 380 e 385:", distY.toFixed(4));

        if (!leftEyeClosed && !rightEyeClosed) {
            hideBothEyes(); // esconde face olhos
        } else if (leftEyeClosed) {
            showOnlyRightEye(); // só direito visível
        } else if (rightEyeClosed) {
            showOnlyLeftEye(); // só esquerdo visível
        } else {
            showAllFace(); // fecha face olhos
        }
    }
}

//  Exemplo de função para verificar proximidade dos pontos
function isEyeClosedByPoints(landmarks, p1Index, p2Index, threshold = 0.01) {
    const p1 = landmarks[p1Index];
    const p2 = landmarks[p2Index];

    if (!p1 || !p2) return false;

    const distY = Math.abs(p1.y - p2.y);
    return distY < threshold;
}


function drawLandmarks(utils, landmarks) {
    const colors = {
        FACE_LANDMARKS_CONTOURS: face_Landmarkers_contours_color,
        TESSELATION: "#C0C0C030",
        RIGHT_EYE: "#FF3030",
        RIGHT_EYEBROW: "#FF3030",
        LEFT_EYE: "#30FF30",
        LEFT_EYEBROW: "#30FF30",
        FACE_OVAL: "#E0E0E0",
        LIPS: "#E0E0E0",
        RIGHT_IRIS: "#FF3030",
        LEFT_IRIS: "#30FF30"
    };

    
    if(false){
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_CONTOURS, { color: colors.FACE_LANDMARKS_CONTOURS, lineWidth: 3 });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: colors.TESSELATION, lineWidth: 1 });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: colors.RIGHT_EYE });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: colors.RIGHT_EYEBROW });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: colors.LEFT_EYE });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: colors.LEFT_EYEBROW });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: colors.FACE_OVAL });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: colors.LIPS });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: colors.RIGHT_IRIS });
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: colors.LEFT_IRIS });
    }
    
    // utils.drawLandmarks(landmarks, { color: colors.FACE_LANDMARKS_CONTOURS, radius: 0.5 });
    utils.drawLandmarks(landmarks, {
        color: face_Landmarkers_contours_color,  // cor dos pontos
        radius: 1.0,                  // raio do ponto
        lineWidth: 1,                // (caso conecte com linhas)
        fillColor: 'rgba(255, 255, 255, 0.5)', // preenchimento
        strokeColor: 'rgba(0, 0, 0, 0.5)',     // contorno (stroke)
        connect: true                // se quiser conectar os pontos
      })

    

    landmarks.forEach((point, index) => {
        if (index === 54) {
            const x = point.x * canvasCtx.canvas.width;
            const y = point.y * canvasCtx.canvas.height;
            const z = point.z ?? 0;
    
            const fontSize = Math.max(3, Math.min(15, 15 - z * 100));
            const lines = [
                `${index} - (x:${point.x.toFixed(2)} - y:${point.y.toFixed(2)} - z:${z.toFixed(2)})`,
                ``,
                ``,
                ``
            ];
    
            // Rotação desejada em graus (altere aqui se quiser outro ângulo)
            const rotationInDegrees = 0;
            const rotation = rotationInDegrees * (Math.PI / 180); // converte para radianos
    
            canvasCtx.save();
    
            // Mover a origem do canvas para o ponto
            canvasCtx.translate(x, y);

            canvasCtx.scale(-1, 1); // agora o texto vai aparecer do lado certo
    
            // Aplicar rotação
            canvasCtx.rotate(rotation);
    
            // Estilo do texto
            canvasCtx.font = `${fontSize}px Arial`;
            // canvasCtx.fillStyle = "yellow";
            canvasCtx.strokeStyle = "black";
            canvasCtx.lineWidth = 2;
    
            // Desenhar cada linha do texto, com espaçamento
            lines.forEach((line, i) => {
                const offsetY = i * fontSize;
                canvasCtx.strokeText(line, 0, offsetY);
                canvasCtx.fillText(line, 0, offsetY);
            });
    
            canvasCtx.restore();
        }
    });

}

function drawBlendShapes(container, blendShapes) {
    if (!blendShapes.length) return;
    container.innerHTML = blendShapes[0].categories.map((shape) => `
    <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${+shape.score * 100}% - 120px)">${(+shape.score).toFixed(4)}</span>
    </li>
    `).join("");
}

function playbackLandmarks() {
    if (record.vLandmarkFrames.length === 0) return;

    let frameIndex = 0;
    const interval = 1000 / 60; // 30 fps

    const playbackInterval = setInterval(() => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const frame = record.vLandmarkFrames[frameIndex];

        if (frame) {
            // const rotated = rotateLandmarksY(frame, (90 * (Math.PI / 180)) ); // gira ~22.5 graus
            const rotated = rotateLandmarksXY(frame, mouse.rotationY, mouse.rotationX);
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            // drawLandmarks(drawingUtils, frame); // usa sua função existente
             drawLandmarks(drawingUtils, rotated);

            frameIndex++;
        } else {
            toggleWebcam();
            document.getElementById("recordBtn").disabled = false;
            document.getElementById("webcamButton").disabled = false;
            clearInterval(playbackInterval);
            console.log("✅ Animação finalizada.", {vLandmarkFrames: record.vLandmarkFrames});
        }
    }, interval);
}

function rotateLandmarksY(landmarks, angleRadians) {
    return landmarks.map(p => {
        const x = p.x - 0.5; // centraliza no meio (opcional)
        const z = p.z ?? 0;
        const newX = x * Math.cos(angleRadians) - z * Math.sin(angleRadians);
        const newZ = x * Math.sin(angleRadians) + z * Math.cos(angleRadians);
        return {
            x: newX + 0.5, // volta pro espaço original (0-1)
            y: p.y,
            z: newZ
        };
    });
}

function rotateLandmarksXY(landmarks, angleY, angleX) {
    return landmarks.map(p => {
        const x = p.x - 0.5;
        const y = p.y - 0.5;
        const z = p.z ?? 0;

        // Rotação eixo Y (esquerda ↔ direita)
        const rotatedX = x * Math.cos(angleY) - z * Math.sin(angleY);
        const rotatedZ_Y = x * Math.sin(angleY) + z * Math.cos(angleY);

        // Rotação eixo X (cima ↔ baixo)
        const rotatedY = y * Math.cos(angleX) - rotatedZ_Y * Math.sin(angleX);
        const rotatedZ = y * Math.sin(angleX) + rotatedZ_Y * Math.cos(angleX);

        return {
            x: rotatedX + 0.5,
            y: rotatedY + 0.5,
            z: rotatedZ
        };
    });
}

function extractRegion(video, landmarks, indices, targetCanvas, targetCtx) {
    // Converte os pontos normalizados para coordenadas reais
    const points = indices.map(({ start }) => {
      const p = landmarks[start];
      return {
        x: p.x * video.videoWidth,
        y: p.y * video.videoHeight
      };
    });
  
    // Define bounding box da região para definir o tamanho do canvas
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
  
    const width = maxX - minX;
    const height = maxY - minY;
  
    // Ajusta canvas
    targetCanvas.width = width;
    targetCanvas.height = height;
  
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.save();
    targetCtx.scale(-1, 1);
    targetCtx.translate(-faceCanvas.width, 0);
  
    // Transforma os pontos para um path relativo ao recorte
    targetCtx.beginPath();
    points.forEach((p, i) => {
      const x = p.x - minX;
      const y = p.y - minY;
      if (i === 0) {
        targetCtx.moveTo(x, y);
      } else {
        targetCtx.lineTo(x, y);
      }
    });
    targetCtx.closePath();
    targetCtx.clip();
  
    // Desenha o vídeo na área recortada
    targetCtx.drawImage(video, minX, minY, width, height, 0, 0, width, height);
    targetCtx.restore();
}

function exportJson (){

    if (record.vLandmarkFrames.length === 0) {
        alert("Nada gravado ainda.");
        return;
    }

    const exportData = {
        landmarks: record.vLandmarkFrames,
        // tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start, end }) => [start, end])
        edges: FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start, end }) => [start, end]),
        triangles: generateTrianglesFromEdges(
            FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start, end }) => [start, end])
        )
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "face_landmarks_with_tess.json";
    a.click();


    // startThreeVisualization(record.vLandmarkFrames, FaceLandmarker.FACE_LANDMARKS_TESSELATION.flatMap(pair => [pair.start, pair.end]));



}

function startThreeVisualization(frames, triangles) {

    if (!frames?.[0]) {
        console.error("❌ Nenhum frame carregado.");
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;


    // Limitar rotação horizontal (opcional)
    // controls.minAzimuthAngle = -Math.PI / 2;
    // controls.maxAzimuthAngle = Math.PI / 2;
    renderer.setSize(500, 500);
    document.body.appendChild(renderer.domElement);

    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    scene.add(cube);


    // Carrega o modelo OBJ
    const loader = new OBJLoader();
    loader.load(
        '/static/faceMesh.obj', // ou 'caminho/para/seuarquivo.obj'
        function (obj) {
            // Corrigir posição
            obj.position.set(0, -1, 0); // (x, y, z)
        
            // Corrigir escala
            obj.scale.set(0.5, 0.5, 0.5); // escala menor se estiver grande demais
        
            // Corrigir rotação (em radianos)
            obj.rotation.x = Math.PI / 2; // gira 90 graus no eixo X
            // obj.rotation.y = Math.PI; // se quiser girar no eixo Y
        
            scene.add(obj);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total) * 100 + '% carregado');
        },
        function (error) {
            console.error('Erro ao carregar OBJ:', error);
        }
    );
    

    game.camera.position.z = 3;

    // 💡 Luz ambiente + direcional
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // luz suave
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 0, 2); // vem da frente
    scene.add(directionalLight);

    // Cria a geometria da malha
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(frames[0].flatMap(p => [
        (p.x - 0.5) * 2,
        (p.y - 0.5) * -2,
        (p.z ?? 0) * 2
    ]));

    const indices = [];
    for (let i = 0; i < triangles.length; i += 3) {
        indices.push(triangles[i], triangles[i + 1], triangles[i + 2]);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Material com luz e profundidade
    const material = new THREE.MeshStandardMaterial({
        color: 0x44aa88,
        metalness: 0.2,
        roughness: 0.6,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 🎥 Animação
    let frameIndex = 0;
    function animate() {
        requestAnimationFrame(animate);

        const points = frames[frameIndex % frames.length];
        for (let i = 0; i < points.length; i++) {
            geometry.attributes.position.setXYZ(
                i,
                (points[i].x - 0.5) * 2,
                (points[i].y - 0.5) * -2,
                (points[i].z ?? 0) * 2
            );
        }
        geometry.attributes.position.needsUpdate = true;

        mesh.rotation.y += 0.005; // rotação automática

        renderer.render(scene, camera);
        frameIndex++;
        controls.update(); // importante
    }

    animate();
}

function generateTrianglesFromEdges(edges) {
    const neighbors = {};

    // Monta um mapa de vizinhos para cada ponto
    edges.forEach(([a, b]) => {
        if (!neighbors[a]) neighbors[a] = new Set();
        if (!neighbors[b]) neighbors[b] = new Set();
        neighbors[a].add(b);
        neighbors[b].add(a);
    });

    const triangles = new Set();

    edges.forEach(([a, b]) => {
        // Encontra vizinhos comuns de a e b
        const common = [...(neighbors[a] || [])].filter(c => neighbors[b].has(c));
        for (const c of common) {
            const tri = [a, b, c].sort((x, y) => x - y).join(",");
            triangles.add(tri);
        }
    });

    // Converte set para array de arrays
    return [...triangles].map(t => t.split(",").map(Number));
}

function createFaceMeshFromLandmarks(points, edges, scene) {
    const geometry = new THREE.BufferGeometry();
  
    // ESCALA para trazer os pontos normalizados para o espaço 3D
    const scale = 2.0;
  
    // Positions (x, y, z) - centralizado e invertido no eixo Y
    const vertices = new Float32Array(points.flatMap(p => [
      (p.x - 0.5) * scale,  // X
      (p.y - 0.5) * -scale, // Y (invertido para bater com o mundo 3D)
      (p.z ?? 0) * scale    // Z
    ]));
  
    // UV Mapping: usa os pontos x e y diretamente, pois já estão normalizados (0~1)
    const uvs = new Float32Array(points.flatMap(p => [p.x, 1 - p.y]));
  
    // Índices (triângulos)
    const triangles = generateTrianglesFromEdges(edges); // você já tem essa função
    const indices = new Uint16Array(triangles.flat());
  
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
  
    // TEXTURA (opcional)
    const texture = new THREE.TextureLoader().load('/static/faceTexture.jpg'); // ou extraída do vídeo
    texture.flipY = false; // importante para UV funcionar com vídeo ou canvas
  
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.2,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
  
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.5; // ajuste fino
    scene.add(mesh);
  
    return mesh;
}

function getEAR(landmarks, eyeIndices) {
    const p = (i) => landmarks[i];
  
    // Pontos principais do olho (exemplo baseado em MediaPipe)
    const left = p(eyeIndices[0]);         // canto externo
    const right = p(eyeIndices[4]);        // canto interno
    const top = p(eyeIndices[1]);          // parte superior
    const bottom = p(eyeIndices[3]);       // parte inferior
  
    const distVertical = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const distHorizontal = Math.hypot(left.x - right.x, left.y - right.y);
  
    return distVertical / distHorizontal;
}

function getEnhancedEAR(landmarks, top1, bottom1, top2, bottom2, left, right) {
    const p = (i) => landmarks[i];

    const vertical1 = Math.hypot(p(top1).x - p(bottom1).x, p(top1).y - p(bottom1).y);
    const vertical2 = Math.hypot(p(top2).x - p(bottom2).x, p(top2).y - p(bottom2).y);
    const vertical = (vertical1 + vertical2) / 2;

    const horizontal = Math.hypot(p(left).x - p(right).x, p(left).y - p(right).y);

    return vertical / horizontal;
}

function updateEARHistory(side, newEAR) {
    const history = EAR_HISTORY[side];
    history.push(newEAR);
    if (history.length > EAR_HISTORY.maxFrames) history.shift();
}

function isEyeClosedFromHistory(side, threshold = 0.2) {
    const history = EAR_HISTORY[side];
    if (history.length < EAR_HISTORY.maxFrames) return false;
    const average = history.reduce((a, b) => a + b, 0) / history.length;
    return average < threshold;
}

function restoreEyeFaces() {
    if (!eyeFacesRemoved || !faceGeometry) return;
    const allTriangles = new Uint16Array(TRIANGULATION); // todos os triângulos
    faceGeometry.setIndex(new THREE.BufferAttribute(allTriangles, 1));
    faceGeometry.computeVertexNormals();
    eyeFacesRemoved = false;
}

function removeEyeFaces() {
    if (eyeFacesRemoved || !faceGeometry) return;
    faceGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(filteredTriangles), 1));
    faceGeometry.computeVertexNormals();
    eyeFacesRemoved = true;
}

function removeLeftEyeFaces() {
    updateFaceMeshWithoutPoints(new Set(LEFT_EYE.concat(LEFT_IRIS)));
}

function removeRightEyeFaces() {
    updateFaceMeshWithoutPoints(new Set(RIGHT_EYE.concat(RIGHT_IRIS)));
}

function restoreLeftEyeFaces() {
    updateFaceMeshWithAllPoints();
}

function restoreRightEyeFaces() {
    updateFaceMeshWithAllPoints();
}

function updateFaceMeshWithoutPoints(pointsToRemoveSet) {
    if (!faceGeometry) return; // <- adiciona essa verificação!

    const visibleTriangles = [];

    for (let i = 0; i < TRIANGULATION.length; i += 3) {
        const a = TRIANGULATION[i];
        const b = TRIANGULATION[i + 1];
        const c = TRIANGULATION[i + 2];

        if (!pointsToRemoveSet.has(a) && !pointsToRemoveSet.has(b) && !pointsToRemoveSet.has(c)) {
            visibleTriangles.push(a, b, c);
        }
    }

    faceGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(visibleTriangles), 1));
    faceGeometry.computeVertexNormals();
}

function updateFaceMeshWithAllPoints() {
    if (!faceGeometry) return; // 🛑 impede o erro

    faceGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(TRIANGULATION), 1));
    faceGeometry.computeVertexNormals();
}

function updateFaceMesh(indices) {
    if (!faceGeometry) return;

    faceGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    faceGeometry.computeVertexNormals();
}

function showAllFace() {
    updateFaceMesh(TRIANGULATION);
}

function hideBothEyes() {
    updateFaceMesh(BASE_TRIANGLES);
}

function showOnlyLeftEye() {
    updateFaceMesh([...BASE_TRIANGLES, ...LEFT_EYE_TRIANGLES]);
}

function showOnlyRightEye() {
    updateFaceMesh([...BASE_TRIANGLES, ...RIGHT_EYE_TRIANGLES]);
}

function meshTrhee() {
    if (!game.scene || !results?.faceLandmarks?.[0]) return;

    // points = ...	Pega os pontos 3D da face
    const points = results.faceLandmarks[0]; 

    // triangles = ...	Conecta pares de pontos com linhas  { start: 10, end: 20 } → vira [10, 20]
    const triangles = FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start, end }) => [start, end]); 

    // faces = ...	Transforma linhas em triângulos ex: [[10, 20, 30], [40, 50, 60]])
    const faces = generateTrianglesFromEdges(triangles);  

    //faces.flat() Aqui você está achatando a lista de triângulos (ex: [[10, 20, 30], [40, 50, 60]]) em uma única lista ([10, 20, 30, 40, 50, 60])
    // const indices = new Uint16Array(faces.flat()); // indices = ...	Prepara os triângulos para o Three.js usar
    const indices = new Uint16Array(filteredTriangles);

    const scale = 5.0;
    const vertices = new Float32Array(points.flatMap(p => [
        (p.x - 0.5) * scale,
        (p.y - 0.5) * -scale,
        -(p.z ?? 0) * scale
    ]));

    const positionFace = new THREE.BufferAttribute(vertices, 3);


    console.log({points, triangles, faces, indices, vertices, positionFace});

    faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute('position', positionFace);
    faceGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    faceGeometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color("white"),
        metalness: 0.0,
        roughness: 0.0,
        side: THREE.FrontSide, //THREE.FrontSide (padrão), THREE.BackSide, ou THREE.DoubleSide
        wireframe: game.wireframe // 👈 habilita o modo wireframe
    });

    faceMesh = new THREE.Mesh(faceGeometry, material);
    faceMesh.position.y = -0.5;
    faceMesh.scale.x = -1;

    
    // game.scene.add(faceMesh);
    faceGroup.add(faceMesh);




    vertexLabels.length = 0; // limpa se já existia
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const labelPos = new THREE.Vector3(
            -(p.x - 0.5) * scale,
            (p.y - 0.5) * -scale,
            -(p.z ?? 0) * scale
        );

        const label = createVertexLabel(i, labelPos);
        vertexLabels.push(label);
        // faceGroup.add(label);
    }


    irisRightMesh = createIrisMesh(RIGHT_IRIS_IDX, points, 0x0000ff);
    irisLeftMesh = createIrisMesh(LEFT_IRIS_IDX, points, 0x0000ff);

    // game.scene.add(irisRightMesh);
    // game.scene.add(irisLeftMesh);

    faceGroup.add(irisRightMesh);
    faceGroup.add(irisLeftMesh);

    game.scene.add(faceGroup);
}

function threeFaceMash(){

    game.scene = new THREE.Scene();
    game.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const controls = new OrbitControls(game.camera, renderer.domElement);

    
    // Permitir zoom
    controls.enableZoom = true;

    // Permitir rotação
    controls.enableRotate = true;

    // Permitir mover (pan)
    controls.enablePan = true;

    // Sensibilidade
    controls.zoomSpeed = 1.2;
    controls.rotateSpeed = 0.8;
    controls.panSpeed = 0.5;

    // Limitar zoom (distância da câmera)
    controls.minDistance = 1;
    controls.maxDistance = 10;

    // Limitar rotação vertical (para não virar de cabeça pra baixo)
    controls.minPolarAngle = 0;              // topo
    controls.maxPolarAngle = Math.PI * 0.9;  // quase embaixo

    faceGroup = new THREE.Group();
    
    game.camera.position.z = 5;
    controls.enableDamping = true;
    renderer.setSize(document.querySelector('#webcam').width, document.querySelector('#webcam').height);
    document.getElementById("threejs-container").style.width = `${document.querySelector('#webcam').width}px`;
    document.getElementById("threejs-container").style.height = `${document.querySelector('#webcam').height}px`;
    // document.body.appendChild(renderer.domElement);
    document.getElementById("threejs-container").appendChild(renderer.domElement);


    // 💡 Luz ambiente + direcional
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // luz suave
    game.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 0, 2); // vem da frente
    game.scene.add(directionalLight);
  
    if(false){
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        game.scene.add(cube);
        console.log({cube});
    }

    if(false){
    
        // Carrega o modelo OBJ
        const loader = new OBJLoader();
        loader.load(
            '/static/faceMesh.obj', // ou 'caminho/para/seuarquivo.obj'
            function (obj) {

                // Aumentar o tamanho do modelo
                obj.scale.set(20, 20, 20); // dobra o tamanho no eixo X, Y, Z
                obj.position.set(0, 0, 0);
                // obj.rotation.x = Math.PI / 2;
                // obj.rotation.y = Math.PI;
                // obj.rotation.z = Math.PI;
                // const geometry = obj.children[0].geometry; // pode ser obj.geometry se for direto
                // geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                // geometry.attributes.position.needsUpdate = true;
                
                game.scene.add(obj);
        
            },
            function (xhr) {
                console.log((xhr.loaded / xhr.total) * 100 + '% carregado');
            },
            function (error) {
                console.error('Erro ao carregar OBJ:', error);
            }
        );
    }

    function updateIrisMesh(mesh, indices, landmarks) {
        const scale = 8.0;
        const attr = mesh.geometry.attributes.position;
        indices.forEach((i, idx) => {
          const p = landmarks[i];
          attr.setXYZ(
            idx,
            (p.x - 0.5) * scale,
            (p.y - 0.5) * -scale,
            -(p.z ?? 0) * scale
          );
        });
        attr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }

    function updateXYZFaceMesh(){
        if (faceGeometry && results?.faceLandmarks?.[0]) {
            const newPoints = results.faceLandmarks[0];

            // Atualiza a malha da face
            for (let i = 0; i < newPoints.length; i++) {
                faceGeometry.attributes.position.setXYZ(
                    i,
                    (newPoints[i].x - 0.5) * 8,
                    (newPoints[i].y - 0.5) * -8,
                    -(newPoints[i].z ?? 0) * 8
                );
            }
            faceGeometry.attributes.position.needsUpdate = true;
            faceGeometry.computeVertexNormals();

            if (irisRightMesh && irisLeftMesh) {
                updateIrisMesh(irisRightMesh, RIGHT_IRIS_IDX, newPoints);
                updateIrisMesh(irisLeftMesh, LEFT_IRIS_IDX, newPoints);
            }

            const offsetY = -0.5;
            for (let i = 0; i < newPoints.length && i < vertexLabels.length; i++) {
                const p = newPoints[i];
                vertexLabels[i].position.set(
                    -(p.x - 0.5) * 8, // 👈 inverte o X para acompanhar o flip
                    (p.y - 0.5) * -8 + offsetY,
                    -(p.z ?? 0) * 8
                );
            }
        }


    
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(game.scene, game.camera);
      updateXYZFaceMesh();
    }
  
    animate();
}

function moveEixoY(event){
    if (!game.camera) return;

    switch (event.key) {
        case '+':
        case '=':
            game.camera.position.z -= 0.2; // zoom in
            break;
        case '-':
        case '_':
            game.camera.position.z += 0.2; // zoom out
            break;
        case 'ArrowUp':
            faceGroup.position.y += 0.1;
            break;
        case 'ArrowDown':
            faceGroup.position.y -= 0.1;
            break;
        case 'ArrowLeft':
            faceGroup.position.x -= 0.1;
            break;
        case 'ArrowRight':
            faceGroup.position.x += 0.1;
            break;
    }
}

function createVertexLabel(index, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `${index}`;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);

    sprite.scale.set(0.2, 0.2, 1); // tamanho ajustável
    sprite.position.copy(position);

    return sprite;
}

function createIrisMesh(indices, landmarks, color = 0x0000ff) {
    const geometry = new THREE.BufferGeometry();
    const scale = 8.0;
  
    const irisPoints = indices.map(i => landmarks[i]);
    const vertices = new Float32Array(irisPoints.flatMap(p => [
      (p.x - 0.5) * scale,
      (p.y - 0.5) * -scale,
      -(p.z ?? 0) * scale
    ]));
  
    const geometryIndices = [];
    for (let i = 0; i < irisPoints.length - 2; i++) {
      geometryIndices.push(0, i + 1, i + 2); // simples "fan" de triângulos
    }
  
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(geometryIndices), 1));
    geometry.computeVertexNormals();
  
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.3,
      side: THREE.DoubleSide
    });
  
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.5;
    mesh.scale.x = -1;
    return mesh;
}

async function initializeFaceLandmarker() {

    // 🧠 O que é WASM?
    // WASM significa WebAssembly.
    // É um formato binário super rápido e compacto, criado para que linguagens como C, C++, Rust, Go, etc. possam rodar na web, lado a lado com JavaScript — mas de forma muito mais eficiente.
    // const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    const filesetResolver = await FilesetResolver.forVisionTasks("/libs/@mediapipe/tasks-vision/wasm");

    console.log({vision, FaceLandmarker, FilesetResolver: filesetResolver, DrawingUtils});
    
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
        //  modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            modelAssetPath: "/libs/@mediapipe/tasks-vision/face_landmarker.task",
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "IMAGE",
        numFaces: 1
    });

    console.log({vision, FaceLandmarker: faceLandmarker, FilesetResolver: filesetResolver, DrawingUtils});

    demosSection.classList.remove("invisible");
    
}

function main(){
    // Inicializa tudo
    initializeFaceLandmarker();
    if (hasGetUserMedia()) webcamButton.addEventListener("click", toggleWebcam);
    else console.warn("getUserMedia() não é suportado neste navegador.");
}


document.getElementById("recordBtn").addEventListener("click", (event) => startRecord(record, event) );
canvasElement.addEventListener("mousedown", (event) => handlerMousedown(mouse, event) );
window.addEventListener("mouseup", (event) => handlerMouseup(mouse, event) );
window.addEventListener("mousemove", (event) => handlerMousemove(mouse, event));
faceCanvas.addEventListener('click', (event) => addStyleActioveFaceCanvas({faceCanvas, canvasElement}, event));
document.getElementById("exportBtn").addEventListener("click", exportJson);
document.getElementById("threeBtn").addEventListener("click", meshTrhee);
window.addEventListener('keydown', moveEixoY);


main();
