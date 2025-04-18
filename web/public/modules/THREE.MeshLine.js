// MeshLine.js
import * as THREE from 'https://esm.sh/three';

export class MeshLine extends THREE.BufferGeometry {
  constructor() {
    super();
    this.isMeshLine = true;
    this.type = 'MeshLine';

    this.positions = [];
    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];
    this.counters = [];
    this._points = [];
    this._geom = null;
    this.widthCallback = null;

    // Used to raycast
    this.matrixWorld = new THREE.Matrix4();

    Object.defineProperties(this, {
      geometry: {
        enumerable: true,
        get: function() {
          return this;
        },
      },
      geom: {
        enumerable: true,
        get: function() {
          return this._geom;
        },
        set: function(value) {
          this.setGeometry(value, this.widthCallback);
        },
      },
      points: {
        enumerable: true,
        get: function() {
          return this._points;
        },
        set: function(value) {
          this.setPoints(value, this.widthCallback);
        },
      },
    });
  }

  setMatrixWorld(matrixWorld) {
    this.matrixWorld = matrixWorld;
  }

  setGeometry(g, c) {
    this._geometry = g;
    this.setPoints(g.getAttribute("position").array, c);
  }

  setPoints(points, wcb) {
    if (!(points instanceof Float32Array) && !(points instanceof Array)) {
      console.error("ERROR: The BufferArray of points is not instancied correctly.");
      return;
    }
    this._points = points;
    this.widthCallback = wcb;
    this.positions = [];
    this.counters = [];
    if (points.length && points[0] instanceof THREE.Vector3) {
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const c = j / points.length;
        this.positions.push(p.x, p.y, p.z);
        this.positions.push(p.x, p.y, p.z);
        this.counters.push(c);
        this.counters.push(c);
      }
    } else {
      for (let j = 0; j < points.length; j += 3) {
        const c = j / points.length;
        this.positions.push(points[j], points[j + 1], points[j + 2]);
        this.positions.push(points[j], points[j + 1], points[j + 2]);
        this.counters.push(c);
        this.counters.push(c);
      }
    }
    this.process();
  }

  raycast(raycaster, intersects) {
    const inverseMatrix = new THREE.Matrix4();
    const ray = new THREE.Ray();
    const sphere = new THREE.Sphere();
    const interRay = new THREE.Vector3();
    const geometry = this;
    // Check boundingSphere distance to ray
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    sphere.copy(geometry.boundingSphere);
    sphere.applyMatrix4(this.matrixWorld);
    if (raycaster.ray.intersectSphere(sphere, interRay) === false) {
      return;
    }
    inverseMatrix.copy(this.matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

    const vStart = new THREE.Vector3();
    const vEnd = new THREE.Vector3();
    const interSegment = new THREE.Vector3();
    const step = this instanceof THREE.LineSegments ? 2 : 1;
    const index = geometry.index;
    const attributes = geometry.attributes;

    if (index !== null) {
      const indices = index.array;
      const positions = attributes.position.array;
      const widths = attributes.width.array;

      for (let i = 0, l = indices.length - 1; i < l; i += step) {
        const a = indices[i];
        const b = indices[i + 1];

        vStart.fromArray(positions, a * 3);
        vEnd.fromArray(positions, b * 3);
        const width = widths[Math.floor(i / 3)] !== undefined ? widths[Math.floor(i / 3)] : 1;
        const precision = raycaster.params.Line.threshold + (this.material.lineWidth * width) / 2;
        const precisionSq = precision * precision;

        const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
        if (distSq > precisionSq) continue;

        interRay.applyMatrix4(this.matrixWorld);
        const distance = raycaster.ray.origin.distanceTo(interRay);
        if (distance < raycaster.near || distance > raycaster.far) continue;

        intersects.push({
          distance: distance,
          point: interSegment.clone().applyMatrix4(this.matrixWorld),
          index: i,
          face: null,
          faceIndex: null,
          object: this,
        });
        i = l;
      }
    }
  }

  compareV3(a, b) {
    const aa = a * 6;
    const ab = b * 6;
    return (
      this.positions[aa] === this.positions[ab] &&
      this.positions[aa + 1] === this.positions[ab + 1] &&
      this.positions[aa + 2] === this.positions[ab + 2]
    );
  }

  copyV3(a) {
    const aa = a * 6;
    return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
  }

  process() {
    const l = this.positions.length / 6;

    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];

    let w;
    let v;
    // initial previous points
    if (this.compareV3(0, l - 1)) {
      v = this.copyV3(l - 2);
    } else {
      v = this.copyV3(0);
    }
    this.previous.push(v[0], v[1], v[2]);
    this.previous.push(v[0], v[1], v[2]);

    for (let j = 0; j < l; j++) {
      this.side.push(1);
      this.side.push(-1);

      if (this.widthCallback) w = this.widthCallback(j / (l - 1));
      else w = 1;
      this.width.push(w);
      this.width.push(w);

      this.uvs.push(j / (l - 1), 0);
      this.uvs.push(j / (l - 1), 1);

      if (j < l - 1) {
        v = this.copyV3(j);
        this.previous.push(v[0], v[1], v[2]);
        this.previous.push(v[0], v[1], v[2]);

        const n = j * 2;
        this.indices_array.push(n, n + 1, n + 2);
        this.indices_array.push(n + 2, n + 1, n + 3);
      }
      if (j > 0) {
        v = this.copyV3(j);
        this.next.push(v[0], v[1], v[2]);
        this.next.push(v[0], v[1], v[2]);
      }
    }
    if (this.compareV3(l - 1, 0)) {
      v = this.copyV3(1);
    } else {
      v = this.copyV3(l - 1);
    }
    this.next.push(v[0], v[1], v[2]);
    this.next.push(v[0], v[1], v[2]);

    if (!this._attributes || this._attributes.position.count !== this.positions.length) {
      this._attributes = {
        position: new THREE.BufferAttribute(new Float32Array(this.positions), 3),
        previous: new THREE.BufferAttribute(new Float32Array(this.previous), 3),
        next: new THREE.BufferAttribute(new Float32Array(this.next), 3),
        side: new THREE.BufferAttribute(new Float32Array(this.side), 1),
        width: new THREE.BufferAttribute(new Float32Array(this.width), 1),
        uv: new THREE.BufferAttribute(new Float32Array(this.uvs), 2),
        index: new THREE.BufferAttribute(new Uint16Array(this.indices_array), 1),
        counters: new THREE.BufferAttribute(new Float32Array(this.counters), 1),
      };
    } else {
      this._attributes.position.copyArray(new Float32Array(this.positions));
      this._attributes.position.needsUpdate = true;
      this._attributes.previous.copyArray(new Float32Array(this.previous));
      this._attributes.previous.needsUpdate = true;
      this._attributes.next.copyArray(new Float32Array(this.next));
      this._attributes.next.needsUpdate = true;
      this._attributes.side.copyArray(new Float32Array(this.side));
      this._attributes.side.needsUpdate = true;
      this._attributes.width.copyArray(new Float32Array(this.width));
      this._attributes.width.needsUpdate = true;
      this._attributes.uv.copyArray(new Float32Array(this.uvs));
      this._attributes.uv.needsUpdate = true;
      this._attributes.index.copyArray(new Uint16Array(this.indices_array));
      this._attributes.index.needsUpdate = true;
    }

    this.setAttribute('position', this._attributes.position);
    this.setAttribute('previous', this._attributes.previous);
    this.setAttribute('next', this._attributes.next);
    this.setAttribute('side', this._attributes.side);
    this.setAttribute('width', this._attributes.width);
    this.setAttribute('uv', this._attributes.uv);
    this.setAttribute('counters', this._attributes.counters);
    this.setIndex(this._attributes.index);

    this.computeBoundingSphere();
    this.computeBoundingBox();
  }

  advance(position) {
    const positions = this._attributes.position.array;
    const previous = this._attributes.previous.array;
    const next = this._attributes.next.array;
    const l = positions.length;

    memcpy(positions, 0, previous, 0, l);
    memcpy(positions, 6, positions, 0, l - 6);
    positions[l - 6] = position.x;
    positions[l - 5] = position.y;
    positions[l - 4] = position.z;
    positions[l - 3] = position.x;
    positions[l - 2] = position.y;
    positions[l - 1] = position.z;

    memcpy(positions, 6, next, 0, l - 6);
    next[l - 6] = position.x;
    next[l - 5] = position.y;
    next[l - 4] = position.z;
    next[l - 3] = position.x;
    next[l - 2] = position.y;
    next[l - 1] = position.z;

    this._attributes.position.needsUpdate = true;
    this._attributes.previous.needsUpdate = true;
    this._attributes.next.needsUpdate = true;
  }
}

function memcpy(src, srcOffset, dst, dstOffset, length) {
  let i;
  if (!src.subarray) src = src.buffer;
  if (!dst.subarray) dst = dst.buffer;
  src = srcOffset
    ? src.subarray
      ? src.subarray(srcOffset, length ? srcOffset + length : src.length)
      : src.slice(srcOffset, length ? srcOffset + length : src.length)
    : src;
  if (dst.set) {
    dst.set(src, dstOffset);
  } else {
    for (i = 0; i < src.length; i++) {
      dst[i + dstOffset] = src[i];
    }
  }
  return dst;
}

export function MeshLineRaycast(raycaster, intersects) {
  const inverseMatrix = new THREE.Matrix4();
  const ray = new THREE.Ray();
  const sphere = new THREE.Sphere();
  const interRay = new THREE.Vector3();
  const geometry = this.geometry;

  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  sphere.copy(geometry.boundingSphere);
  sphere.applyMatrix4(this.matrixWorld);
  if (raycaster.ray.intersectSphere(sphere, interRay) === false) {
    return;
  }
  inverseMatrix.copy(this.matrixWorld).invert();
  ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

  const vStart = new THREE.Vector3();
  const vEnd = new THREE.Vector3();
  const interSegment = new THREE.Vector3();
  const step = this instanceof THREE.LineSegments ? 2 : 1;
  const index = geometry.index;
  const attributes = geometry.attributes;

  if (index !== null) {
    const indices = index.array;
    const positions = attributes.position.array;
    const widths = attributes.width.array;

    for (let i = 0, l = indices.length - 1; i < l; i += step) {
      const a = indices[i];
      const b = indices[i + 1];

      vStart.fromArray(positions, a * 3);
      vEnd.fromArray(positions, b * 3);
      const width = widths[Math.floor(i / 3)] !== undefined ? widths[Math.floor(i / 3)] : 1;
      const precision = raycaster.params.Line.threshold + (this.material.lineWidth * width) / 2;
      const precisionSq = precision * precision;

      const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
      if (distSq > precisionSq) continue;

      interRay.applyMatrix4(this.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(interRay);
      if (distance < raycaster.near || distance > raycaster.far) continue;

      intersects.push({
        distance: distance,
        point: interSegment.clone().applyMatrix4(this.matrixWorld),
        index: i,
        face: null,
        faceIndex: null,
        object: this,
      });
      i = l;
    }
  }
}

MeshLine.prototype.raycast = MeshLineRaycast;

MeshLine.prototype.copyV3 = function(a) {
  const aa = a * 6;
  return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
};

MeshLine.prototype.compareV3 = function(a, b) {
  const aa = a * 6;
  const ab = b * 6;
  return (
    this.positions[aa] === this.positions[ab] &&
    this.positions[aa + 1] === this.positions[ab + 1] &&
    this.positions[aa + 2] === this.positions[ab + 2]
  );
};

MeshLine.prototype.advance = function(position) {
  const positions = this._attributes.position.array;
  const previous = this._attributes.previous.array;
  const next = this._attributes.next.array;
  const l = positions.length;

  memcpy(positions, 0, previous, 0, l);
  memcpy(positions, 6, positions, 0, l - 6);
  positions[l - 6] = position.x;
  positions[l - 5] = position.y;
  positions[l - 4] = position.z;
  positions[l - 3] = position.x;
  positions[l - 2] = position.y;
  positions[l - 1] = position.z;

  memcpy(positions, 6, next, 0, l - 6);
  next[l - 6] = position.x;
  next[l - 5] = position.y;
  next[l - 4] = position.z;
  next[l - 3] = position.x;
  next[l - 2] = position.y;
  next[l - 1] = position.z;

  this._attributes.position.needsUpdate = true;
  this._attributes.previous.needsUpdate = true;
  this._attributes.next.needsUpdate = true;
};

export class MeshLineMaterial extends THREE.ShaderMaterial {
  constructor(parameters) {
    super({
      uniforms: Object.assign({}, THREE.UniformsLib.fog, {
        lineWidth: { value: 1 },
        map: { value: null },
        useMap: { value: 0 },
        alphaMap: { value: null },
        useAlphaMap: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        opacity: { value: 1 },
        resolution: { value: new THREE.Vector2(1, 1) },
        sizeAttenuation: { value: 1 },
        dashArray: { value: 0 },
        dashOffset: { value: 0 },
        dashRatio: { value: 0.5 },
        useDash: { value: 0 },
        visibility: { value: 1 },
        alphaTest: { value: 0 },
        repeat: { value: new THREE.Vector2(1, 1) },
      }),
      vertexShader: THREE.ShaderChunk.meshline_vert,
      fragmentShader: THREE.ShaderChunk.meshline_frag,
    });
    this.isMeshLineMaterial = true;
    this.type = 'MeshLineMaterial';

    Object.defineProperties(this, {
      lineWidth: {
        enumerable: true,
        get: function() {
          return this.uniforms.lineWidth.value;
        },
        set: function(value) {
          this.uniforms.lineWidth.value = value;
        },
      },
      map: {
        enumerable: true,
        get: function() {
          return this.uniforms.map.value;
        },
        set: function(value) {
          this.uniforms.map.value = value;
        },
      },
      useMap: {
        enumerable: true,
        get: function() {
          return this.uniforms.useMap.value;
        },
        set: function(value) {
          this.uniforms.useMap.value = value;
        },
      },
      alphaMap: {
        enumerable: true,
        get: function() {
          return this.uniforms.alphaMap.value;
        },
        set: function(value) {
          this.uniforms.alphaMap.value = value;
        },
      },
      useAlphaMap: {
        enumerable: true,
        get: function() {
          return this.uniforms.useAlphaMap.value;
        },
        set: function(value) {
          this.uniforms.useAlphaMap.value = value;
        },
      },
      color: {
        enumerable: true,
        get: function() {
          return this.uniforms.color.value;
        },
        set: function(value) {
          this.uniforms.color.value = value;
        },
      },
      opacity: {
        enumerable: true,
        get: function() {
          return this.uniforms.opacity.value;
        },
        set: function(value) {
          this.uniforms.opacity.value = value;
        },
      },
      resolution: {
        enumerable: true,
        get: function() {
          return this.uniforms.resolution.value;
        },
        set: function(value) {
          this.uniforms.resolution.value.copy(value);
        },
      },
      sizeAttenuation: {
        enumerable: true,
        get: function() {
          return this.uniforms.sizeAttenuation.value;
        },
        set: function(value) {
          this.uniforms.sizeAttenuation.value = value;
        },
      },
      dashArray: {
        enumerable: true,
        get: function() {
          return this.uniforms.dashArray.value;
        },
        set: function(value) {
          this.uniforms.dashArray.value = value;
          this.useDash = value !== 0 ? 1 : 0;
        },
      },
      dashOffset: {
        enumerable: true,
        get: function() {
          return this.uniforms.dashOffset.value;
        },
        set: function(value) {
          this.uniforms.dashOffset.value = value;
        },
      },
      dashRatio: {
        enumerable: true,
        get: function() {
          return this.uniforms.dashRatio.value;
        },
        set: function(value) {
          this.uniforms.dashRatio.value = value;
        },
      },
      useDash: {
        enumerable: true,
        get: function() {
          return this.uniforms.useDash.value;
        },
        set: function(value) {
          this.uniforms.useDash.value = value;
        },
      },
      visibility: {
        enumerable: true,
        get: function() {
          return this.uniforms.visibility.value;
        },
        set: function(value) {
          this.uniforms.visibility.value = value;
        },
      },
      alphaTest: {
        enumerable: true,
        get: function() {
          return this.uniforms.alphaTest.value;
        },
        set: function(value) {
          this.uniforms.alphaTest.value = value;
        },
      },
      repeat: {
        enumerable: true,
        get: function() {
          return this.uniforms.repeat.value;
        },
        set: function(value) {
          this.uniforms.repeat.value.copy(value);
        },
      },
    });

    this.setValues(parameters);
  }

  copy(source) {
    super.copy(source);
    this.lineWidth = source.lineWidth;
    this.map = source.map;
    this.useMap = source.useMap;
    this.alphaMap = source.alphaMap;
    this.useAlphaMap = source.useAlphaMap;
    this.color.copy(source.color);
    this.opacity = source.opacity;
    this.resolution.copy(source.resolution);
    this.sizeAttenuation = source.sizeAttenuation;
    this.dashArray = source.dashArray;
    this.dashOffset = source.dashOffset;
    this.dashRatio = source.dashRatio;
    this.useDash = source.useDash;
    this.visibility = source.visibility;
    this.alphaTest = source.alphaTest;
    this.repeat.copy(source.repeat);
    return this;
  }
}


