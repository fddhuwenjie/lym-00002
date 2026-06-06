export class LSystem {
  constructor(options = {}) {
    this.axiom = options.axiom || 'F';
    this.rules = options.rules || [];
    this.iterations = options.iterations || 4;
    this.currentString = this.axiom;
  }

  setAxiom(axiom) {
    this.axiom = axiom;
  }

  setRules(rules) {
    this.rules = rules;
  }

  setIterations(n) {
    this.iterations = Math.max(1, Math.min(7, parseInt(n) || 1));
  }

  parseRule(ruleStr) {
    const predMatch = ruleStr.match(/^([A-Za-z])(\(([^)]+)\))?\s*->\s*(.+)$/);
    if (!predMatch) {
      return {
        predecessor: ruleStr.charAt(0),
        successor: ruleStr.length > 1 ? ruleStr.slice(1) : ruleStr,
        params: [],
        condition: null
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
      } catch (e) {
        return match;
      }
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

  getString() {
    return this.currentString;
  }

  getTokens() {
    return this.currentTokens || this.tokenize(this.currentString);
  }
}
