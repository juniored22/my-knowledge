import * as THREE from 'https://esm.sh/three';

export const Floor = ({color=0xbcbcbc, name=''}={}) => {
    const geo = new THREE.BoxGeometry( 2000, 0.1, 2000 );
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0 });
    const floor = new THREE.Mesh( geo, mat );
    floor.position.y = -4;
    return floor
}