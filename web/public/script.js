
// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import vision from "/libs/@mediapipe/tasks-vision/vision_bundle.mjs";

import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';
import { OrbitControls } from '/static/OrbitControls.js'; // <-- arquivo local
import { OBJLoader } from '/static/OBJLoader.js'; // <-- arquivo local

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
const drawingUtils = new DrawingUtils(canvasCtx);
const videoWidth = 480;
const maxRecordingTimeMs = 10000;


let faceLandmarker;
let runningMode = "IMAGE"; 
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;

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
    // test()


}

function main(){
    // Inicializa tudo
    initializeFaceLandmarker();
    if (hasGetUserMedia()) webcamButton.addEventListener("click", toggleWebcam);
    else console.warn("getUserMedia() não é suportado neste navegador.");
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
    

    camera.position.z = 3;

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

function test(){
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    renderer.setSize(500, 500);
    document.body.appendChild(renderer.domElement);
  
    // const cube = new THREE.Mesh(
    //   new THREE.BoxGeometry(),
    //   new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    // );
    // scene.add(cube);
    // console.log({cube});
    
  
    camera.position.z = 5;


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
            
            // scene.add(obj);
    
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total) * 100 + '% carregado');
        },
        function (error) {
            console.error('Erro ao carregar OBJ:', error);
        }
    );



    const points = record.vLandmarkFrames[0]; // ou results.faceLandmarks[0]
    const triangles = FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start, end }) => [start, end]);
    const geometry = new THREE.BufferGeometry();

    const uvs = new Float32Array(points.flatMap(p => [p.x, 1 - p.y]));

    const scale = 8.0; // você pode ajustar esse valor

    const vertices = new Float32Array(points.flatMap(p => [
    (p.x - 0.5) * scale,
    (p.y - 0.5) * -scale,
    -(p.z ?? 0) * scale
    ]));

    // ⚠️ Agora você precisa transformar os pares de edges em triângulos:
    const faces = generateTrianglesFromEdges(triangles); // você já tem essa função


    const indices = new Uint16Array(faces.flat());
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();


    // geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    // geometry.setIndex(faces.flat()); // flat porque cada triângulo é [a, b, c]
    // geometry.computeVertexNormals();

    // AQUI: cria a textura a partir do canvas com a face
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.flipY = true; // obrigatório para vídeo/webcam
    texture.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.6,
        side: THREE.DoubleSide
      });

 

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.5;
    scene.add(mesh);



    


    // 💡 Luz ambiente + direcional
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // luz suave
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 0, 2); // vem da frente
    scene.add(directionalLight);
  

  
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
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


  

document.getElementById("recordBtn").addEventListener("click", (event) => startRecord(record, event) );
canvasElement.addEventListener("mousedown", (event) => handlerMousedown(mouse, event) );
window.addEventListener("mouseup", (event) => handlerMouseup(mouse, event) );
window.addEventListener("mousemove", (event) => handlerMousemove(mouse, event));
faceCanvas.addEventListener('click', (event) => addStyleActioveFaceCanvas({faceCanvas, canvasElement}, event));
document.getElementById("exportBtn").addEventListener("click", exportJson);

main();
