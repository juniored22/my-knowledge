
// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";

const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

const demosSection = document.getElementById("demos");
const videoBlendShapes = document.getElementById("video-blend-shapes");
const webcamButton = document.getElementById("webcamButton");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const videoWidth = 480;
let faceLandmarker, runningMode = "IMAGE", webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

async function initializeFaceLandmarker() {
    // const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    const filesetResolver = await FilesetResolver.forVisionTasks("/libs/@mediapipe/tasks-vision/wasm");
    
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
}

function drawLandmarks(utils, landmarks) {
    const colors = {
    TESSELATION: "#C0C0C070",
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

    // landmarks.forEach((point, index) => {

    //     if(index == 473){
    //         console.log(`Ponto ${index}: x=${point.x.toFixed(4)}, y=${point.y.toFixed(4)}, z=${point.z?.toFixed(4) ?? 'N/A'}`, point);
    //     }
        
    // });

        // Desenhar os valores no canvas
        canvasCtx.font = "10px Arial";
        canvasCtx.fillStyle = "yellow";
        canvasCtx.strokeStyle = "black";
        canvasCtx.lineWidth = 2;

        landmarks.forEach((point, index) => {
            if(index == 100){
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

// Inicializa tudo
initializeFaceLandmarker();
if (hasGetUserMedia()) webcamButton.addEventListener("click", toggleWebcam);
else console.warn("getUserMedia() não é suportado neste navegador.");
