
// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";

// FaceLandmarker	Detecta pontos da face, íris, sobrancelhas, lábios etc.
// FilesetResolver	Carrega os arquivos .wasm e resolve paths
// DrawingUtils	Ferramentas para desenhar os pontos no canvas
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

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


const videoWidth = 480;
let faceLandmarker, runningMode = "IMAGE", webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

let landmarkFrames = []; // <- guarda a animação
const maxRecordingTimeMs = 10000;
let recording = false;
let recordingStart = 0;

let rotationY = 0; // ângulo de rotação em torno do eixo Y
let rotationX = 0; // Inclinação vertical (eixo X)
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

document.getElementById("recordBtn").addEventListener("click", () => {
    recording = true;
    recordingStart = performance.now();
    landmarkFrames = [];
    console.log("🎥 Gravando landmarks por 5 segundos...");
    document.getElementById("recordBtn").disabled = true
    document.getElementById("webcamButton").disabled = true
    
});

canvasElement.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});
  
window.addEventListener("mouseup", () => {
    isDragging = false;
});
  
window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  
    rotationY += deltaX * 0.005; // lateral = rotação Y
    rotationX += deltaY * 0.005; // vertical = rotação X
  
    // Limita para não virar de cabeça pra baixo
    rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX));
});


faceCanvas.addEventListener('click', ()=>{
    faceCanvas.classList.toggle('face_canva_webcam_background');
    canvasElement.classList.toggle('background_transparent')
})

console.log({vision});

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

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function toggleWebcam() {
    if (!faceLandmarker) return console.log("FaceLandmarker não carregado ainda.");
    webcamRunning = !webcamRunning;
    webcamButton.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

    if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
    }
}

async function predictWebcam() {
    const aspectRatio = video.videoHeight / video.videoWidth;
    Object.assign(video.style, { width: `${videoWidth}px`, height: `${videoWidth * aspectRatio}px` });
    Object.assign(canvasElement.style, { width: `${videoWidth}px`, height: `${videoWidth * aspectRatio}px` });
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

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

    if (recording && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const now = performance.now();
        if (now - recordingStart < maxRecordingTimeMs) {
            // Clona os landmarks do frame atual
            const landmarksCopy = structuredClone(results.faceLandmarks[0]);
            landmarkFrames.push(landmarksCopy);
        } else {
            recording = false;
            console.log("🛑 Gravação finalizada! Frames capturados:", landmarkFrames.length);
            toggleWebcam();
            setTimeout(playbackLandmarks, 1000); // espera 1s e toca a animação
        }
    }

    if (true && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Recorta a imagem da boca usando os landmarks
        extractRegion(video, landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, mouthCanvas, mouthCtx);
    }
}

function drawLandmarks(utils, landmarks) {
    const colors = {
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

    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: colors.TESSELATION, lineWidth: 1 });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: colors.RIGHT_EYE });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: colors.RIGHT_EYEBROW });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: colors.LEFT_EYE });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: colors.LEFT_EYEBROW });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: colors.FACE_OVAL });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: colors.LIPS });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: colors.RIGHT_IRIS });
    utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: colors.LEFT_IRIS });
    
    //   utils.drawLandmarks(landmarks, { color: colors.LEFT_IRIS, radius: 1 })

    // Desenhar os valores no canvas
    canvasCtx.font = "10px Arial";
    canvasCtx.fillStyle = "yellow";
    canvasCtx.strokeStyle = "black";
    canvasCtx.lineWidth = 2;

    landmarks.forEach((point, index) => {
        if(index == 332){
            const x = point.x * canvasCtx.canvas.width;
            const y = point.y * canvasCtx.canvas.height;
        
            const text = `${index}\nx:${point.x.toFixed(2)} y:${point.y.toFixed(2)} z:${point.z?.toFixed(2) ?? 'N/A'}`;

            // Fundo preto pra dar contraste
            canvasCtx.strokeText(text, x, y);
            canvasCtx.fillText(text, x, y);
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
    if (landmarkFrames.length === 0) return;

    let frameIndex = 0;
    const interval = 1000 / 60; // 30 fps

    const playbackInterval = setInterval(() => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const frame = landmarkFrames[frameIndex];

        if (frame) {
            // const rotated = rotateLandmarksY(frame, (90 * (Math.PI / 180)) ); // gira ~22.5 graus
            const rotated = rotateLandmarksXY(frame, rotationY, rotationX);
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            // drawLandmarks(drawingUtils, frame); // usa sua função existente
             drawLandmarks(drawingUtils, rotated);

            frameIndex++;
        } else {
            toggleWebcam();
            document.getElementById("recordBtn").disabled = false;
            document.getElementById("webcamButton").disabled = false;
            clearInterval(playbackInterval);
            console.log("✅ Animação finalizada.", {landmarkFrames});
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
  


// Inicializa tudo
initializeFaceLandmarker();
if (hasGetUserMedia()) webcamButton.addEventListener("click", toggleWebcam);
else console.warn("getUserMedia() não é suportado neste navegador.");
