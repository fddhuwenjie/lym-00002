export const PRESETS = {
  'binary-tree': {
    name: '二叉树',
    axiom: 'X',
    angle: 25,
    iterations: 4,
    length: 1.2,
    lengthDecay: 0.7,
    thickness: 0.1,
    thicknessDecay: 0.7,
    colorStem: '#8B4513',
    colorLeaf: '#228B22',
    rules: [
      { predecessor: 'X', successor: 'F[&+X][&-X][^/X][^\\X]%', probability: 1 },
      { predecessor: 'F', successor: 'FF', probability: 1 }
    ]
  },

  'pythagoras': {
    name: '毕达哥拉斯树',
    axiom: 'X',
    angle: 40,
    iterations: 4,
    length: 0.9,
    lengthDecay: 0.7,
    thickness: 0.12,
    thicknessDecay: 0.7,
    colorStem: '#654321',
    colorLeaf: '#32CD32',
    rules: [
      { predecessor: 'X', successor: 'F[&+X][\\X][^-X][/X][&\\X][^/X]F%', probability: 1 },
      { predecessor: 'F', successor: 'FF', probability: 1 }
    ]
  },

  'fern': {
    name: '蕨类',
    axiom: 'X',
    angle: 22,
    iterations: 5,
    length: 0.5,
    lengthDecay: 0.6,
    thickness: 0.05,
    thicknessDecay: 0.55,
    colorStem: '#556B2F',
    colorLeaf: '#90EE90',
    rules: [
      { predecessor: 'X', successor: 'F[&+X][^/X][&\\X][^-X]F%', probability: 0.7 },
      { predecessor: 'X', successor: 'F[^+X][&/X][^\\X][&-X]F%', probability: 0.3 },
      { predecessor: 'F', successor: 'FF', probability: 1 }
    ]
  },

  'koch': {
    name: 'Koch 曲线',
    axiom: 'F',
    angle: 60,
    iterations: 4,
    length: 0.5,
    lengthDecay: 1,
    thickness: 0.05,
    thicknessDecay: 0.8,
    colorStem: '#1E90FF',
    colorLeaf: '#87CEFA',
    rules: [
      { predecessor: 'F', successor: 'F+F&F-F^F\\F+F', probability: 1 }
    ]
  },

  'dragon': {
    name: '龙曲线',
    axiom: 'FX',
    angle: 90,
    iterations: 7,
    length: 0.3,
    lengthDecay: 1,
    thickness: 0.04,
    thicknessDecay: 0.9,
    colorStem: '#FF4500',
    colorLeaf: '#FF8C00',
    rules: [
      { predecessor: 'X', successor: 'X+YF&+\\X+YF+', probability: 1 },
      { predecessor: 'Y', successor: '-FX-Y^/-FX-Y', probability: 1 }
    ]
  },

  'sierpinski': {
    name: 'Sierpinski',
    axiom: 'A',
    angle: 60,
    iterations: 5,
    length: 0.4,
    lengthDecay: 1,
    thickness: 0.04,
    thicknessDecay: 0.85,
    colorStem: '#9932CC',
    colorLeaf: '#DA70D6',
    rules: [
      { predecessor: 'A', successor: 'B-A&B\\A-B&/A-B', probability: 1 },
      { predecessor: 'B', successor: 'A+B^A/B+A^\\B+A', probability: 1 }
    ]
  },

  'hilbert3d': {
    name: 'Hilbert 3D',
    axiom: 'X',
    angle: 90,
    iterations: 3,
    length: 0.8,
    lengthDecay: 0.5,
    thickness: 0.08,
    thicknessDecay: 0.5,
    colorStem: '#FF1493',
    colorLeaf: '#FF69B4',
    rules: [
      { predecessor: 'X', successor: '&F\\YF&+F^X-F^&X-F+YF^&+\\X^F+YF&X/', probability: 1 },
      { predecessor: 'Y', successor: '^F/XF^-F&Y+F&^Y+F-XF&^-/Y^F-XF&Y\\', probability: 1 }
    ]
  }
};

export function getPreset(name) {
  return PRESETS[name] || PRESETS['binary-tree'];
}

export function getDefaultPreset() {
  return PRESETS['binary-tree'];
}

export function getAllPresetNames() {
  return Object.keys(PRESETS);
}
