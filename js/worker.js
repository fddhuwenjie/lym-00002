class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
    return this;
  }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  multiply(q) {
    const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
    const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
    const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
    const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
    this.x = x; this.y = y; this.z = z; this.w = w;
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(halfAngle);
    return this;
  }
  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len > 0) { this.x /= len; this.y /= len; this.z /= len; this.w /= len; }
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
  clone() { const s = new TurtleState(); return s.copy(this); }
}

class Turtle3D {
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
    this.meshData = { cylinders: [], leaves: [], spheres: [] };
  }

  getForwardVector() {
    const forward = new Vector3(0, 1, 0);
    this.state.heading.applyToVector(forward);
    return forward.normalize();
  }

  rotateYaw(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const up = new Vector3(0, 0, -1);
    this.state.heading.applyToVector(up);
    const q = new Quaternion().setFromAxisAngle(up.normalize(), angle);
    this.state.heading.multiply(q).normalize();
  }

  rotatePitch(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const right = new Vector3(1, 0, 0);
    this.state.heading.applyToVector(right);
    const q = new Quaternion().setFromAxisAngle(right.normalize(), angle);
    this.state.heading.multiply(q).normalize();
  }

  rotateRoll(angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const forward = new Vector3(0, 1, 0);
    this.state.heading.applyToVector(forward);
    const q = new Quaternion().setFromAxisAngle(forward.normalize(), angle);
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

  decrementThickness() { this.state.thickness *= this.thicknessDecay; }
  incrementColor() { this.state.colorIndex++; }
  reverseDirection() { this.rotateYaw(180); }

  interpret(tokens, onProgress) {
    this.reset();
    const total = tokens.length;

    for (let i = 0; i < total; i++) {
      const token = tokens[i];
      const symbol = token.symbol;
      const params = token.params || [];

      switch (symbol) {
        case 'F': case 'G': case 'A': case 'B':
          this.forward(params[0] || 1, true); break;
        case 'f': case 'g':
          this.forward(params[0] || 1, false); break;
        case '+': this.rotateYaw(params[0] || this.angle); break;
        case '-': this.rotateYaw(-(params[0] || this.angle)); break;
        case '&': this.rotatePitch(params[0] || this.angle); break;
        case '^': this.rotatePitch(-(params[0] || this.angle)); break;
        case '\\': case '<': this.rotateRoll(params[0] || this.angle); break;
        case '/': case '>': this.rotateRoll(-(params[0] || this.angle)); break;
        case '|': this.reverseDirection(); break;
        case '[': this.pushState(); break;
        case ']': this.popState(); break;
        case '!': this.decrementThickness(); break;
        case '\'': this.incrementColor(); break;
        case '%': case 'L': case 'l':
          this.drawLeaf(); break;
        default: break;
      }

      if (onProgress && i % 500 === 0) {
        onProgress(i / total, i, total);
      }
    }

    if (onProgress) onProgress(1, total, total);
    return this.meshData;
  }
}

class LSystem {
  constructor(options = {}) {
    this.axiom = options.axiom || 'F';
    this.rules = options.rules || [];
    this.iterations = options.iterations || 4;
    this.currentString = this.axiom;
  }

  setAxiom(axiom) { this.axiom = axiom; }
  setRules(rules) { this.rules = rules; }
  setIterations(n) { this.iterations = Math.max(1, Math.min(7, parseInt(n) || 1)); }

  parseRule(ruleStr) {
    const predMatch = ruleStr.match(/^([A-Za-z])(\(([^)]+)\))?\s*->\s*(.+)$/);
    if (!predMatch) {
      return {
        predecessor: ruleStr.charAt(0),
        successor: ruleStr.length > 1 ? ruleStr.slice(1) : ruleStr,
        params: [], condition: null
      };
    }
    const predecessor = predMatch[1];
    const paramStr = predMatch[3];
    const successor = predMatch[4].trim();
    const params = paramStr ? paramStr.split(',').map(p => p.trim()) : [];
    return { predecessor, successor, params, condition: null };
  }

  selectRule(predecessor, rules) {
    const matchingRules = rules.filter(r => {
      const pred = typeof r.predecessor === 'string' ? r.predecessor : r.predecessor.symbol;
      return pred === predecessor;
    });
    if (matchingRules.length === 0) return null;
    if (matchingRules.length === 1) return matchingRules[0];
    const totalProb = matchingRules.reduce((sum, r) => sum + (r.probability || 1), 0);
    let random = Math.random() * totalProb;
    for (const rule of matchingRules) {
      random -= (rule.probability || 1);
      if (random <= 0) return rule;
    }
    return matchingRules[matchingRules.length - 1];
  }

  substitute(symbol, rules, params = {}) {
    const rule = this.selectRule(symbol, rules);
    if (!rule) return symbol;
    let successor = rule.successor;
    if (rule.params && rule.params.length > 0) {
      for (let i = 0; i < rule.params.length; i++) {
        const paramName = rule.params[i];
        const value = params[paramName] !== undefined ? params[paramName] : 1;
        const regex = new RegExp(`\\b${paramName}\\b`, 'g');
        successor = successor.replace(regex, value);
      }
    }
    return this.evaluateExpressions(successor, params);
  }

  evaluateExpressions(str, params) {
    return str.replace(/\(([^)]+)\)/g, (match, expr) => {
      try {
        let evalExpr = expr;
        for (const [key, value] of Object.entries(params)) {
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          evalExpr = evalExpr.replace(regex, value);
        }
        const result = Function('"use strict"; return (' + evalExpr + ')')();
        return `(${result.toFixed(2)})`;
      } catch (e) { return match; }
    });
  }

  tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const char = str[i];
      if (/[A-Za-z]/.test(char)) {
        let token = { symbol: char, params: [] };
        if (i + 1 < str.length && str[i + 1] === '(') {
          let depth = 1;
          let paramStr = '';
          i += 2;
          while (i < str.length && depth > 0) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') depth--;
            if (depth > 0) paramStr += str[i];
            i++;
          }
          if (paramStr) {
            token.params = paramStr.split(',').map(p => {
              const trimmed = p.trim();
              const num = parseFloat(trimmed);
              return isNaN(num) ? trimmed : num;
            });
          }
          tokens.push(token);
        } else {
          tokens.push(token);
          i++;
        }
      } else if (char === '[' || char === ']' || char === '+' || char === '-' ||
                 char === '&' || char === '^' || char === '\\' || char === '/' ||
                 char === '<' || char === '>' ||
                 char === '|' || char === '!' || char === '\'' || char === '%') {
        tokens.push({ symbol: char, params: [] });
        i++;
      } else {
        i++;
      }
    }
    return tokens;
  }

  stringifyTokens(tokens) {
    return tokens.map(t => {
      if (t.params && t.params.length > 0) {
        return `${t.symbol}(${t.params.join(',')})`;
      }
      return t.symbol;
    }).join('');
  }

  generate(onProgress) {
    this.currentString = this.axiom;
    let currentTokens = this.tokenize(this.axiom);
    const parsedRules = this.rules.map(r => {
      if (typeof r === 'string') {
        return { ...this.parseRule(r), probability: 1 };
      }
      if (typeof r.predecessor === 'string') {
        const parsed = this.parseRule(`${r.predecessor}->${r.successor}`);
        return { ...parsed, probability: r.probability || 1 };
      }
      return { ...r, probability: r.probability || 1 };
    });

    for (let i = 0; i < this.iterations; i++) {
      const newTokens = [];
      for (let j = 0; j < currentTokens.length; j++) {
        const token = currentTokens[j];
        const params = {};
        if (token.params && token.params.length > 0) {
          const rule = this.selectRule(token.symbol, parsedRules);
          if (rule && rule.params) {
            rule.params.forEach((p, idx) => {
              params[p] = token.params[idx] !== undefined ? token.params[idx] : 1;
            });
          }
        }
        const substitution = this.substitute(token.symbol, parsedRules, params);
        if (substitution === token.symbol && (!token.params || token.params.length === 0)) {
          newTokens.push(token);
        } else {
          const subTokens = this.tokenize(substitution);
          newTokens.push(...subTokens);
        }
      }
      currentTokens = newTokens;
      if (onProgress) {
        onProgress((i + 1) / this.iterations, i + 1, this.iterations);
      }
    }
    this.currentString = this.stringifyTokens(currentTokens);
    this.currentTokens = currentTokens;
    return { string: this.currentString, tokens: currentTokens };
  }

  getString() { return this.currentString; }
  getTokens() { return this.currentTokens || this.tokenize(this.currentString); }
}

let currentTaskId = null;
let isCancelled = false;

self.onmessage = function(e) {
  const { type, taskId, data } = e.data;

  if (type === 'cancel') {
    isCancelled = true;
    return;
  }

  if (type === 'generate') {
    currentTaskId = taskId;
    isCancelled = false;

    try {
      const { config } = data;
      const lsystem = new LSystem({
        axiom: config.axiom,
        rules: config.rules,
        iterations: config.iterations
      });

      const genResult = lsystem.generate((progress, current, total) => {
        if (isCancelled) throw new Error('cancelled');
        self.postMessage({
          type: 'progress',
          taskId,
          stage: 'generating',
          progress,
          message: `生成中... ${current}/${total}`
        });
      });

      if (isCancelled) return;

      self.postMessage({
        type: 'progress',
        taskId,
        stage: 'drawing',
        progress: 0,
        message: '绘制中...'
      });

      const turtle = new Turtle3D({
        angle: config.angle,
        length: config.length,
        lengthDecay: config.lengthDecay,
        thickness: config.thickness,
        thicknessDecay: config.thicknessDecay,
        colorStem: config.colorStem,
        colorLeaf: config.colorLeaf
      });

      const meshData = turtle.interpret(genResult.tokens, (progress, current, total) => {
        if (isCancelled) throw new Error('cancelled');
        if (current % 1000 === 0) {
          self.postMessage({
            type: 'progress',
            taskId,
            stage: 'drawing',
            progress,
            message: `绘制中... ${current}/${total}`
          });
        }
      });

      if (!isCancelled) {
        self.postMessage({
          type: 'complete',
          taskId,
          data: {
            meshData,
            stringLength: genResult.string.length,
            tokenCount: genResult.tokens.length
          }
        });
      }
    } catch (error) {
      if (error.message === 'cancelled') {
        self.postMessage({ type: 'cancelled', taskId });
      } else {
        self.postMessage({
          type: 'error',
          taskId,
          error: error.message
        });
      }
    }
  }
};
