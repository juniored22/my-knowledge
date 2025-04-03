function onResults(results) {
    if (results.handLandmarks) {
        const landmarks = results.handLandmarks[0]; // Primeira mão detectada (se houver)

        // Atualiza a posição da mão no Three.js
        updateHandPosition(Game.players[0].mesh.leftHand, landmarks);
    }
}

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


function updateEdges(handObj, landmarks, scale = 3) {
    const positions = handObj.edgesGeometry.getAttribute('position').array;
    for (let i = 0; i < handConnections.length; i++) {
      const [startIdx, endIdx] = handConnections[i];
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      console.log({start, end});
      
      // Mapeia a coordenada x: centraliza (subtraindo 0.5) e aplica escala
      positions[i * 6 + 0] = -((start.x - 0.5) * scale); // flip X
      positions[i * 6 + 1] = -(start.y - 0.5) * scale;
      positions[i * 6 + 2] = start.z * scale;
      
      positions[i * 6 + 3] = -((end.x - 0.5) * scale);   // flip X
      positions[i * 6 + 4] = -(end.y - 0.5) * scale;
      positions[i * 6 + 5] = end.z * scale;
    }
    handObj.edgesGeometry.getAttribute('position').needsUpdate = true;
}


function mySkinnedMesh(material){
    const geometry = new THREE.CylinderGeometry( 5, 5, 5, 5, 15, 5, 30 );
    const sizing = {
        segmentHeight: 5 / 15, // altura total (5) dividido pelo número de segmentos verticais (15)
        halfHeight: 5 / 2 // metade da altura total
    };
    const bones = createBones();

    // create the skin indices and skin weights manually
    // (typically a loader would read this data from a 3D model for you)

    const position = geometry.attributes.position;

    const vertex = new THREE.Vector3();

    const skinIndices = [];
    const skinWeights = [];

    for ( let i = 0; i < position.count; i ++ ) {

        vertex.fromBufferAttribute( position, i );

        // compute skinIndex and skinWeight based on some configuration data
        const y = ( vertex.y + sizing.halfHeight );
        const skinIndex = Math.floor( y / sizing.segmentHeight );
        const skinWeight = ( y % sizing.segmentHeight ) / sizing.segmentHeight;
        skinIndices.push( skinIndex, skinIndex + 1, 0, 0 );
        skinWeights.push( 1 - skinWeight, skinWeight, 0, 0 );
    }

    geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
    geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );

    // create skinned mesh and skeleton

    const skinnedMesh = new THREE.SkinnedMesh( geometry, material );
    const skeletonSkinnedMesh = new THREE.Skeleton( bones );

    // see example from THREE.Skeleton
    const rootBone = skeletonSkinnedMesh.bones[ 0 ];
    skinnedMesh.add( rootBone );

    // bind the skeleton to the mesh
    skinnedMesh.bind( skeletonSkinnedMesh );

    // move the bones and manipulate the model
    skeletonSkinnedMesh.bones[ 0 ].rotation.x = -0.1;
    skeletonSkinnedMesh.bones[ 1 ].rotation.x = 0.2;

    
    return { skinnedMesh, skeletonSkinnedMesh }; // Retorna ambos, útil para animações


}


function createBones() {
    const bones = [];
    let prevBone = new THREE.Bone();
    bones.push(prevBone);
    prevBone.position.y = -2.5; // começo do cilindro (metade da altura negativa)
  
    for (let i = 1; i <= 15; i++) {
      const bone = new THREE.Bone();
      bone.position.y = 5 / 15; // altura de cada segmento
      prevBone.add(bone);
      bones.push(bone);
      prevBone = bone;
    }
  
    return bones;
}



function centerHand(landmarks) {
    const base = landmarks[0]; // ponto 0 = pulso
    return landmarks.map((pt) => ({
      x: pt.x - base.x,
      y: pt.y - base.y,
      z: pt.z - base.z
    }));
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

function createBoneLabel(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 64;
  
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '20px Arial';
    context.fillStyle = '#ffffff';
    context.fillText(name, 10, 40);
  
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 3, 3); // ajusta o tamanho
    return sprite;
}
  
