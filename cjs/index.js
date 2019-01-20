'use strict';
const WeakMap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('@ungap/weakmap'));
const tta = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('@ungap/template-tag-arguments'));
const {Wire, wireType, isArray} = require('./shared.js');
const Tagger = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('./tagger.js'));

const wm = new WeakMap;
const templateType = 0;

let current = null;

// can be used with any useRef hook
// returns an `html` and `svg` function
const hook = useRef => ({
  html: createHook(useRef, html),
  svg: createHook(useRef, svg)
});
exports.hook = hook;

// generic content render
function render(node, callback) {
  const content = update.call(this, node, callback);
  if (content !== null)
    appendClean(node, content);
  return node;
}
exports.render = render

// keyed render via render(node, () => html`...`)
// non keyed renders in the wild via html`...`
const html = outer('html');
exports.html = html;
const svg = outer('svg');
exports.svg = svg;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function appendClean(node, fragment) {
  node.textContent = '';
  node.appendChild(fragment);
}

function asNode(result) {
  return result.nodeType === wireType ? result.valueOf(true) : result;
}

function createHook(useRef, view) {
  return function () {
    const ref = useRef(null);
    if (ref.current === null)
      ref.current = content.bind(ref);
    return ref.current.apply(null, arguments);
  };
  function content() {
    const args = [];
    for (let i = 0, {length} = arguments; i < length; i++)
      args[i] = arguments[i];
    const content = update(this, () => view.apply(null, args));
    if (content)
      this.content = content;
    return this.content;
  }
}

function outer($) {
  return function () {
    const _ = tta.apply(null, arguments);
    return current ?
      {nodeType: 0, valueOf, $, _} :
      new Tagger($).apply(null, _);
  };
}

function set(node) {
  const info = {i: 0, length: 0, stack: [], template: null};
  wm.set(node, info);
  return info;
}

function setTemplate(template) {
  if (current.template) {
    current.length = 0;
    current.stack.splice(0);
  }
  current.template = template;
}

function unroll(template) {
  const {$, _} = template;
  const {i, length, stack} = current;
  current.i++;
  if (i < length) {
    const {tagger, literal, wire} = stack[i];
    const args = unrollArray(_, 1);
    if (args[0] === literal) {
      tagger.apply(null, unrollArray(_, 1));
      return wire;
    }
    return wireIndex($, _, stack, i);
  }
  return wireIndex($, _, stack, -1);
}

function unrollArray(array, i) {
  for (const {length} = array; i < length; i++) {
    const value = array[i];
    if (value) {
      if (value.nodeType === 0)
        array[i] = unroll(value);
      else if (isArray(value))
        array[i] = unrollArray(value, 0);
    }
  }
  return array;
}

function update(reference, callback) {
  const prev = current;
  current = wm.get(reference) || set(reference);
  current.i = 0;

  // TODO: perf measurement about guarding this
  const result = callback.call(this);

  let ret = null;
  if (result.nodeType === templateType) {
    const template = result._[0];

    // TODO: perf measurement about guarding this
    const content = unroll(result);

    const {i} = current;
    if (i < current.length) {
      current.length = i;
      current.stack.splice(i);
    }
    if (current.template !== template) {
      setTemplate(template);
      ret = asNode(content);
    }
  }
  else {
    setTemplate(null);
    ret = asNode(result);
  }

  current = prev;
  return ret;
}

function wireContent(node) {
  const childNodes = node.childNodes;
  const {length} = childNodes;
  return length === 1 ?
    childNodes[0] :
    (length ? new Wire(childNodes) : node);
}

function wireIndex($, _, stack, i) {
  const tagger = new Tagger($);
  const stacked = {tagger, literal: _[0], wire: null};
  if (i < 0)
    current.length = stack.push(stacked);
  else
    stack[i] = stacked;
  stacked.wire = wireContent(tagger.apply(null, unrollArray(_, 1)));
  return stacked.wire;
}
