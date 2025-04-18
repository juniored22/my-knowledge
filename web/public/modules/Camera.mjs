import * as THREE from 'https://esm.sh/three';


export const Camera = ({fov=45, aspect, near = 0.1, far=1000, width, height} = {})=>{
    const camera = new THREE.PerspectiveCamera(fov, aspect, near , far);
    camera.position.z = 5;
    camera.position.y = 3;
    return camera;
}