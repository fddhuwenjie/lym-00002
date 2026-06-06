import { SceneManager } from './scene.js';
import { OBJExporter } from './objExporter.js';
import { getPreset, getDefaultPreset, getAllPresetNames } from './presets.js';

class App {
  constructor() {
    this.currentPreset = null;
    this.currentTaskId = 0;
    this.debounceTimer = null;
    this.worker = null;
    this.config = this.createDefaultConfig();
    this.init();
  }

  createDefaultConfig() {
    const preset = getDefaultPreset();
    return {
      axiom: preset.axiom,
      rules: [...preset.rules],
      iterations: preset.iterations,
      angle: preset.angle,
      length: preset.length,
      lengthDecay: preset.lengthDecay,
      thickness: preset.thickness,
      thicknessDecay: preset.thicknessDecay,
      colorStem: preset.colorStem,
      colorLeaf: preset.colorLeaf
    };
  }

  init() {
    this.initWorker();
    this.initScene();
    this.initUI();
    this.loadFromURL() || this.loadPreset('binary-tree');
    this.generate();
  }

  initWorker() {
    this.worker = new Worker('js/worker.js', { type: 'module' });
    this.worker.onmessage = (e) => this.handleWorkerMessage(e);
  }

  initScene() {
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);
    this.createLoadingOverlay();
  }

  createLoadingOverlay() {
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    this.loadingOverlay.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text" id="loading-text">生成中...</div>
    `;
    document.querySelector('.viewport').appendChild(this.loadingOverlay);
  }

  showLoading(text) {
    document.getElementById('loading-text').textContent = text || '生成中...';
    this.loadingOverlay.classList.add('show');
  }

  hideLoading() {
    this.loadingOverlay.classList.remove('show');
  }

  initUI() {
    this.ui = {
      iterations: document.getElementById('iterations'),
      iterationsValue: document.getElementById('iterations-value'),
      angle: document.getElementById('angle'),
      length: document.getElementById('length'),
      lengthDecay: document.getElementById('length-decay'),
      thickness: document.getElementById('thickness'),
      thicknessDecay: document.getElementById('thickness-decay'),
      axiom: document.getElementById('axiom'),
      colorStem: document.getElementById('color-stem'),
      colorLeaf: document.getElementById('color-leaf'),
      rulesContainer: document.getElementById('rules-container'),
      addRuleBtn: document.getElementById('add-rule'),
      exportObj: document.getElementById('export-obj'),
      exportJson: document.getElementById('export-json'),
      importJson: document.getElementById('import-json'),
      importFile: document.getElementById('import-file'),
      copyUrl: document.getElementById('copy-url'),
      statusText: document.getElementById('status-text'),
      stringLength: document.getElementById('string-length'),
      presetBtns: document.querySelectorAll('.preset-btn')
    };

    this.bindEvents();
  }

  bindEvents() {
    this.ui.iterations.addEventListener('input', (e) => {
      this.config.iterations = parseInt(e.target.value);
      this.ui.iterationsValue.textContent = e.target.value;
      this.scheduleGenerate();
    });

    this.ui.angle.addEventListener('input', (e) => {
      this.config.angle = parseFloat(e.target.value);
      this.scheduleGenerate();
    });

    this.ui.length.addEventListener('input', (e) => {
      this.config.length = parseFloat(e.target.value);
      this.scheduleGenerate();
    });

    this.ui.lengthDecay.addEventListener('input', (e) => {
      this.config.lengthDecay = parseFloat(e.target.value);
      this.scheduleGenerate();
    });

    this.ui.thickness.addEventListener('input', (e) => {
      this.config.thickness = parseFloat(e.target.value);
      this.scheduleGenerate();
    });

    this.ui.thicknessDecay.addEventListener('input', (e) => {
      this.config.thicknessDecay = parseFloat(e.target.value);
      this.scheduleGenerate();
    });

    this.ui.axiom.addEventListener('input', (e) => {
      this.config.axiom = e.target.value;
      this.scheduleGenerate();
    });

    this.ui.colorStem.addEventListener('input', (e) => {
      this.config.colorStem = e.target.value;
      this.scheduleGenerate();
    });

    this.ui.colorLeaf.addEventListener('input', (e) => {
      this.config.colorLeaf = e.target.value;
      this.scheduleGenerate();
    });

    this.ui.addRuleBtn.addEventListener('click', () => {
      this.addRule({ predecessor: 'F', successor: 'F[+F]F[-F]F', probability: 1 });
      this.scheduleGenerate();
    });

    this.ui.exportObj.addEventListener('click', () => this.exportOBJ());
    this.ui.exportJson.addEventListener('click', () => this.exportJSON());
    this.ui.importJson.addEventListener('click', () => this.ui.importFile.click());
    this.ui.importFile.addEventListener('change', (e) => this.importJSON(e));
    this.ui.copyUrl.addEventListener('click', () => this.copyShareURL());

    this.ui.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetName = btn.dataset.preset;
        this.loadPreset(presetName);
        this.generate();
      });
    });
  }

  addRule(ruleData) {
    const ruleItem = document.createElement('div');
    ruleItem.className = 'rule-item';
    ruleItem.innerHTML = `
      <div class="rule-header">
        <span class="rule-pred" contenteditable="true">${ruleData.predecessor}</span>
        <span class="rule-arrow">→</span>
        <input type="text" class="rule-input" value="${ruleData.successor}" />
        <button class="rule-remove" title="删除规则">×</button>
      </div>
      <div class="rule-prob">
        <label>概率:</label>
        <input type="number" step="0.1" min="0" max="10" value="${ruleData.probability || 1}" />
      </div>
    `;

    const predSpan = ruleItem.querySelector('.rule-pred');
    const succInput = ruleItem.querySelector('.rule-input');
    const probInput = ruleItem.querySelector('.rule-prob input');
    const removeBtn = ruleItem.querySelector('.rule-remove');

    predSpan.addEventListener('input', () => {
      this.updateRulesFromUI();
      this.scheduleGenerate();
    });

    succInput.addEventListener('input', () => {
      this.updateRulesFromUI();
      this.scheduleGenerate();
    });

    probInput.addEventListener('input', () => {
      this.updateRulesFromUI();
      this.scheduleGenerate();
    });

    removeBtn.addEventListener('click', () => {
      ruleItem.remove();
      this.updateRulesFromUI();
      this.scheduleGenerate();
    });

    this.ui.rulesContainer.appendChild(ruleItem);
    return ruleItem;
  }

  updateRulesFromUI() {
    const ruleItems = this.ui.rulesContainer.querySelectorAll('.rule-item');
    this.config.rules = [];

    ruleItems.forEach(item => {
      const pred = item.querySelector('.rule-pred').textContent.trim();
      const succ = item.querySelector('.rule-input').value.trim();
      const prob = parseFloat(item.querySelector('.rule-prob input').value) || 1;

      if (pred && succ) {
        this.config.rules.push({
          predecessor: pred,
          successor: succ,
          probability: prob
        });
      }
    });
  }

  updateUIFromConfig() {
    this.ui.iterations.value = this.config.iterations;
    this.ui.iterationsValue.textContent = this.config.iterations;
    this.ui.angle.value = this.config.angle;
    this.ui.length.value = this.config.length;
    this.ui.lengthDecay.value = this.config.lengthDecay;
    this.ui.thickness.value = this.config.thickness;
    this.ui.thicknessDecay.value = this.config.thicknessDecay;
    this.ui.axiom.value = this.config.axiom;
    this.ui.colorStem.value = this.config.colorStem;
    this.ui.colorLeaf.value = this.config.colorLeaf;

    this.ui.rulesContainer.innerHTML = '';
    this.config.rules.forEach(rule => this.addRule(rule));
  }

  loadPreset(name) {
    this.currentPreset = name;
    const preset = getPreset(name);
    this.config = {
      axiom: preset.axiom,
      rules: [...preset.rules],
      iterations: preset.iterations,
      angle: preset.angle,
      length: preset.length,
      lengthDecay: preset.lengthDecay,
      thickness: preset.thickness,
      thicknessDecay: preset.thicknessDecay,
      colorStem: preset.colorStem,
      colorLeaf: preset.colorLeaf
    };
    this.updateUIFromConfig();
    this.updatePresetButtons();
    this.updateURL();
  }

  updatePresetButtons() {
    this.ui.presetBtns.forEach(btn => {
      if (btn.dataset.preset === this.currentPreset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  scheduleGenerate() {
    this.currentPreset = null;
    this.updatePresetButtons();
    this.updateURL();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.generate();
    }, 300);
  }

  generate() {
    this.currentTaskId++;
    const taskId = this.currentTaskId;

    this.ui.statusText.className = 'processing';
    this.ui.statusText.textContent = '处理中...';
    this.showLoading('生成中...');

    if (this.worker) {
      this.worker.postMessage({
        type: 'cancel',
        taskId: taskId - 1
      });
    }

    this.worker.postMessage({
      type: 'generate',
      taskId,
      data: { config: { ...this.config } }
    });
  }

  handleWorkerMessage(e) {
    const { type, taskId, data, progress, message, error } = e.data;

    if (taskId !== this.currentTaskId) return;

    if (type === 'progress') {
      document.getElementById('loading-text').textContent = message;
    } else if (type === 'complete') {
      this.sceneManager.buildMesh(data.meshData);
      this.ui.statusText.className = 'ready';
      this.ui.statusText.textContent = '就绪';
      this.ui.stringLength.textContent = `字符串长度: ${data.stringLength} | 符号数: ${data.tokenCount}`;
      this.hideLoading();
    } else if (type === 'error') {
      this.ui.statusText.textContent = '错误: ' + error;
      this.hideLoading();
    } else if (type === 'cancelled') {
      this.hideLoading();
    }
  }

  exportOBJ() {
    const meshes = this.sceneManager.getPlantMeshes();
    if (meshes.length === 0) {
      alert('没有可导出的模型');
      return;
    }
    OBJExporter.download(meshes, `lsystem-${Date.now()}.obj`);
  }

  exportJSON() {
    const exportData = {
      preset: this.currentPreset,
      config: { ...this.config },
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lsystem-config-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.config) {
          this.config = { ...data.config };
          this.currentPreset = data.preset || null;
          this.updateUIFromConfig();
          this.updatePresetButtons();
          this.updateURL();
          this.generate();
        }
      } catch (err) {
        alert('导入失败: 无效的 JSON 文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  updateURL() {
    const params = new URLSearchParams();
    params.set('p', this.currentPreset || 'custom');
    params.set('a', this.config.axiom);
    params.set('i', this.config.iterations);
    params.set('ang', this.config.angle);
    params.set('l', this.config.length);
    params.set('ld', this.config.lengthDecay);
    params.set('t', this.config.thickness);
    params.set('td', this.config.thicknessDecay);
    params.set('cs', this.config.colorStem);
    params.set('cl', this.config.colorLeaf);

    const rulesStr = this.config.rules
      .map(r => `${r.predecessor}|${r.successor}|${r.probability || 1}`)
      .join('||');
    params.set('r', encodeURIComponent(rulesStr));

    const newURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

  loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('p')) return false;

    const preset = params.get('p');
    if (preset && preset !== 'custom' && getAllPresetNames().includes(preset)) {
      this.loadPreset(preset);
      return true;
    }

    if (params.has('a') && params.has('r')) {
      try {
        this.config.axiom = params.get('a');
        this.config.iterations = parseInt(params.get('i')) || 4;
        this.config.angle = parseFloat(params.get('ang')) || 25;
        this.config.length = parseFloat(params.get('l')) || 1;
        this.config.lengthDecay = parseFloat(params.get('ld')) || 0.7;
        this.config.thickness = parseFloat(params.get('t')) || 0.1;
        this.config.thicknessDecay = parseFloat(params.get('td')) || 0.7;
        this.config.colorStem = params.get('cs') || '#8B4513';
        this.config.colorLeaf = params.get('cl') || '#228B22';

        const rulesStr = decodeURIComponent(params.get('r'));
        this.config.rules = rulesStr.split('||').map(r => {
          const [pred, succ, prob] = r.split('|');
          return {
            predecessor: pred,
            successor: succ,
            probability: parseFloat(prob) || 1
          };
        });

        this.updateUIFromConfig();
        this.currentPreset = 'custom';
        this.updatePresetButtons();
        return true;
      } catch (e) {
        console.error('URL 解析失败', e);
      }
    }

    return false;
  }

  copyShareURL() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = this.ui.copyUrl;
      const originalText = btn.textContent;
      btn.textContent = '✓ 已复制';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }).catch(() => {
      prompt('复制以下链接分享:', url);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
