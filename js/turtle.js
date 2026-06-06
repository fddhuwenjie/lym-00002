class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  multiply(q) {
    const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
    const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
    const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
    const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(halfAngle);
    return this;
  }

  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
      this.w /= len;
    }
    return this;
  }

  applyToVector(v) {
    const q = this;
    const vx = v.x, vy = v.y, vz = v.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;

    v.x = ix * qw + iw * (-qx) + iy * (-qz) - iz * (-qy);
    v.y = iy * qw + iw * (-qy) + iz * (-qx) - ix * (-qz);
    v.z = iz * qw + iw * (-qz) + ix * (-qy) - iy * (-qx);

    return v;
  }
}

class TurtleState {
  constructor() {
    this.position = new Vector3(0, 0, 0);
    this.heading = new Quaternion();
    this.thickness = 0.1;
    this.colorIndex = 0;
    this.lengthScale = 1;
  }

  copy(s) {
    this.position.copy(s.position);
    this.heading.copy(s.heading);
    this.thickness = s.thickness;
    this.colorIndex = s.colorIndex;
    this.lengthScale = s.lengthScale;
    return this;
  }

  clone() {
    const s = new TurtleState();
    return s.copy(this);
  }
}

export class Turtle3D {
  constructor(options = {}) {
    this.state = new TurtleState();
    this.stack = [];
    this.angle = options.angle || 25;
    this.length = options.length || 1;
    this.lengthDecay = options.lengthDecay || 0.7;
    this.thickness = options.thickness || 0.1;
    this.thicknessDecay = options.thicknessDecay || 0.7;
    this.colorStem = options.colorStem || '#8B4513';
    this.colorLeaf = options.colorLeaf || '#228B22';
    this.colors = [this.colorStem, this.colorLeaf];
    this.state.thickness = this.thickness;
    this.reset();
  }

  setOptions(options) {
    if (options.angle !== undefined) this.angle = options.angle;
    if (options.length !== undefined) this.length = options.length;
    if (options.lengthDecay !== undefined) this.lengthDecay = options.lengthDecay;
    if (options.thickness !== undefined) {
      this.thickness = options.thickness;
      this.state.thickness = this.thickness;
    }
    if (options.thicknessDecay !== undefined) this.thicknessDecay = options.thicknessDecay;
    if (options.colorStem !== undefined) {
      this.colorStem = options.colorStem;
      this.colors[0] = this.colorStem;
    }
    if (options.colorLeaf !== undefined) {
      this.colorLeaf = options.colorLeaf;
      this.colors[1] = this.colorLeaf;
    }
  }

  reset() {
    this.state = new TurtleState();
    this.state.thickness = this.thickness;
    this.stack = [];
    this.meshData = {
      cylinders: [],
      leaves: [],
      spheres: []
    };
  }

  getForwardVector() {
    const forward = new Vector3(0, 1, 0);
    this.state.heading.applyToVector(forward);
    return forward.normalize();
  }

  getRightVector() {
    const right = new Vector3(1, 0, 0);
    this.state.heading.applyToVector(right);
    return right.normalize();
  }

  getUpVector() {
    const up = new Vector3(0, 0, -1);
    this.state.heading.applyToVector(up);
    return up.normalize();
  }

  rotateYaw(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const localUp = new Vector3(0, 0, -1);
    const q = new Quaternion().setFromAxisAngle(localUp, angle);
    this.state.heading.multiply(q).normalize();
  }

  rotatePitch(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const localRight = new Vector3(1, 0, 0);
    const q = new Quaternion().setFromAxisAngle(localRight, angle);
    this.state.heading.multiply(q).normalize();
  }

  rotateRoll(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const localForward = new Vector3(0, 1, 0);
    const q = new Quaternion().setFromAxisAngle(localForward, angle);
    this.state.heading.multiply(q).normalize();
  }

  forward(distance, draw = true) {
    const scaledDist = distance * this.length * this.state.lengthScale;
    const forward = this.getForwardVector().multiplyScalar(scaledDist);
    const start = this.state.position.clone();
    const end = this.state.position.clone().add(forward);

    if (draw) {
      const quat = this.state.heading.clone();
      this.meshData.cylinders.push({
        start: { x: start.x, y: start.y, z: start.z },
        end: { x: end.x, y: end.y, z: end.z },
        radiusTop: this.state.thickness * 0.7,
        radiusBottom: this.state.thickness,
        height: scaledDist,
        quaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
        color: this.colors[this.state.colorIndex % this.colors.length]
      });
    }

    this.state.position.copy(end);
  }

  drawLeaf() {
    const pos = this.state.position.clone();
    const forward = this.getForwardVector();
    const quat = this.state.heading.clone();
    this.meshData.leaves.push({
      position: { x: pos.x, y: pos.y, z: pos.z },
      normal: { x: forward.x, y: forward.y, z: forward.z },
      quaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
      size: this.length * this.state.lengthScale * 0.8,
      color: this.colors[(this.state.colorIndex + 1) % this.colors.length]
    });
  }

  pushState() {
    this.stack.push(this.state.clone());
    this.state.lengthScale *= this.lengthDecay;
    this.state.thickness *= this.thicknessDecay;
  }

  popState() {
    if (this.stack.length > 0) {
      this.state = this.stack.pop();
    }
  }

  decrementThickness() {
    this.state.thickness *= this.thicknessDecay;
  }

  incrementColor() {
    this.state.colorIndex++;
  }

  reverseDirection() {
    this.rotateYaw(180);
  }

  setThickness(t) {
    this.state.thickness = t;
  }

  interpret(tokens, onProgress) {
    this.reset();
    const total = tokens.length;
    const degToRad = Math.PI / 180;

    for (let i = 0; i < total; i++) {
      const token = tokens[i];
      const symbol = token.symbol;
      const params = token.params || [];

      switch (symbol) {
        case 'F':
        case 'G':
        case 'A':
        case 'B':
          this.forward(params[0] || 1, true);
          break;
        case 'f':
        case 'g':
          this.forward(params[0] || 1, false);
          break;
        case '+':
          this.rotateYaw(params[0] || this.angle);
          break;
        case '-':
          this.rotateYaw(-(params[0] || this.angle));
          break;
        case '&':
          this.rotatePitch(params[0] || this.angle);
          break;
        case '^':
          this.rotatePitch(-(params[0] || this.angle));
          break;
        case '\\':
          this.rotateRoll(params[0] || this.angle);
          break;
        case '/':
          this.rotateRoll(-(params[0] || this.angle));
          break;
        case '|':
          this.reverseDirection();
          break;
        case '[':
          this.pushState();
          break;
        case ']':
          this.popState();
          break;
        case '!':
          this.decrementThickness();
          break;
        case '\'':
          this.incrementColor();
          break;
        case '%':
          this.drawLeaf();
          break;
        case 'L':
        case 'l':
          this.drawLeaf();
          break;
        default:
          break;
      }

      if (onProgress && i % 500 === 0) {
        onProgress(i / total, i, total);
      }
    }

    if (onProgress) {
      onProgress(1, total, total);
    }

    return this.meshData;
  }
}
