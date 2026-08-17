// apps/colorpicker/app.js

// ::: vendors
import { html, signal, useState } from '@aufbau/kits/preact-htm';
import { converter, formatHex, interpolate, modeHsl, modeLab, modeLch, modeLrgb, modeOklab, modeOklch, modeRgb, parse, useMode } from 'culori';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Icon } from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';


useMode(modeHsl);
useMode(modeLab);
useMode(modeLch);
useMode(modeLrgb);
useMode(modeOklab);
useMode(modeOklch);
useMode(modeRgb);

// ── CSS string helpers ────────────────────────────────────────────────────────
let _hex   = hex       => `#${hex}`;
let _hsl   = (h,s,l)   =>   `hsl(${h} ${s}% ${l}%)`;
let _lch   = (l,c,h)   =>   `lch(${l} ${c} ${h})`;
let _oklch = (l,c,h)   => `oklch(${l} ${c} ${h})`;
let _rgb   = (r,g,b)   =>   `rgb(${r} ${g} ${b})`;
let _rgba  = (r,g,b,a) =>  `rgba(${r} ${g} ${b} / ${a})`;

let cssStringRGB = (v = color.value) => {
  let { r=0, g=0, b=0 } = toRgb(v);
  return _rgb(Math.round(r*255), Math.round(g*255), Math.round(b*255));
};
let cssStringHSL = (v = color.value) => {
  let { h=0, s=0, l=0 } = toHsl(v);
  return _hsl(Math.round(h), Math.round(s*100), Math.round(l*100));
};
let cssStringLCH = (v = color.value) => {
  let { l=0, c=0, h=0 } = toLch(v);
  return _lch(l.toFixed(1), c.toFixed(2), Math.round(h));
};
let cssStringOKLCH = (v = color.value) => {
  let { l=0, c=0, h=0 } = v;
  return _oklch((l*100).toFixed(1)+'%', c.toFixed(4), Math.round(h));
};

// ── CopyRows ──────────────────────────────────────────────────────────────────
function CopyRows({ value, children }) {
  value ??= color.value;
  return html`
    <div class="copy-rows">
      ${children}
      <${CopyRow} label="hex"   value=${toHex(value)}         />
      <${CopyRow} label="rgb"   value=${cssStringRGB(value)}  />
      <${CopyRow} label="hsl"   value=${cssStringHSL(value)}  />
      <${CopyRow} label="lch"   value=${cssStringLCH(value)}  />
      <${CopyRow} label="oklch" value=${cssStringOKLCH(value)}/>
    </div>`;
}
function CopyRow({ label, value }) {
  let [copied, setCopied] = useState(false);
  let doCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return html`
    <div class="copy-row">
      <span class="copy-label">${label}</span>
      <code class="copy-value">${value}</code>
      <button class="ghost-btn" onClick=${doCopy}>
        <${Icon} name=${copied ? 'mdi:check' : 'mdi:content-copy'} />
      </button>
    </div>`;
}

// ── converters ────────────────────────────────────────────────────────────────
let toRgb   = converter('rgb');
let toHsl   = converter('hsl');
let toLch   = converter('lch');
let toOklch = converter('oklch');
//let toHex   = c => { try { return formatHex(c) ?? '#000000'; } catch { return '#000000'; } };
let toHex   = c => { try { return !c ? '#000000' : (formatHex(c) ?? '#000000'); } catch { return '#000000'; } };
let clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── global state ──────────────────────────────────────────────────────────────
let color   = signal(toOklch(parse('#3b82f6')));  // shared across tabs
let tab     = stored('OKLCH', 'colorpicker:tab');
let TABS    = ['RGB', 'HSL', 'LCH', 'OKLCH', 'Mix', 'Shades'];
let TAB_MAP = { RGB: RGBTab, HSL: HSLTab, LCH: LCHTab, OKLCH: OKLCHTab, Mix: MixTab, Shades: ShadesTab };


// ── shared components ─────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, gradient, onChange }) {
  const disp  = Number.isInteger(step) ? Math.round(value) : +value.toFixed(step < 0.01 ? 4 : 2);
  const width = (String(max).replace('.','').length + (step < 1 ? 2 : 0)) + 'ch';

  return html`
    <div class="slider-row">
      <span class="slider-label">${label}</span>
      <div class="slider-track" style=${gradient ? { '--gradient': gradient } : {}}>
        <input type="range" min=${min} max=${max} step=${step}
          value=${value} onInput=${e => onChange(+e.target.value)} />
      </div>
      <input type="number" class="field num-input" min=${min} max=${max} step=${step}
        style=${{ width }}
        value=${disp} onInput=${e => onChange(clamp(+e.target.value, min, max))} />
    </div>`;
}
/*
function SliderRGB ({ r, g, b }) {
  let onChange = v => set('r', v);
  let gradient = 'linear-gradient(to right,rgb(0,'+g+','+b+'),rgb(255,'+g+','+b+')';
  
  return html`
    <${Slider} label="R" value=${r} min=0 max=255
    gradient=${gradient}
    onChange=${onChange} />
  `;
}
*/

let Swatch = ({ hex, size = '' }) => html`<div class=${'swatch' + (size ? ' swatch-' + size : '')} style=${{ background: hex }} />`;

// ── TABS ────────────────────────────────────────────────────────────
// ── Tab: RGB
function RGBTab() {
  let rgb = toRgb(color.value);
  let r   = Math.round((rgb.r ?? 0) * 255);
  let g   = Math.round((rgb.g ?? 0) * 255);
  let b   = Math.round((rgb.b ?? 0) * 255);
  let hex = toHex(color.value);

  let set = (ch, v) => color.value = toOklch({ ...toRgb(color.value), [ch]: v / 255 });

  return html`
    <div class="tab-content">
      <${Slider} label="R" value=${r} min=0 max=255
        gradient=${'linear-gradient(to right,rgb(0,'+g+','+b+'),rgb(255,'+g+','+b+')'}
        onChange=${v => set('r', v)} />
      <${Slider} label="G" value=${g} min=0 max=255
        gradient=${'linear-gradient(to right,rgb('+r+',0,'+b+'),rgb('+r+',255,'+b+')'}
        onChange=${v => set('g', v)} />
      <${Slider} label="B" value=${b} min=0 max=255
        gradient=${'linear-gradient(to right,rgb('+r+','+g+',0),rgb('+r+','+g+',255)'}
        onChange=${v => set('b', v)} />
      <div class="hex-row">
        <span class="slider-label">Hex</span>
        <input class="field hex-input" type="text" maxlength="7" value=${hex}
          onInput=${e => { let c = parse(e.target.value); if (c) color.value = toOklch(c); }} />
        <input type="color" class="native-color" value=${hex}
          onInput=${e => { let c = parse(e.target.value); if (c) color.value = toOklch(c); }} />
      </div>
      <${CopyRows} value=${color.value} />
    </div>`;
}
// ── Tab: HSL
function HSLTab() {
  let hsl = toHsl(color.value);
  let h   = Math.round(hsl.h  ?? 0);
  let s   = Math.round((hsl.s ?? 0) * 100);
  let l   = Math.round((hsl.l ?? 0) * 100);

  let set = (ch, v) => color.value = toOklch({ ...toHsl(color.value), [ch]: ch === 'h' ? v : v / 100 });

  return html`
    <div class="tab-content">
      <${Slider} label="H" value=${h} min=0 max=360
        gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
        onChange=${v => set('h', v)} />
      <${Slider} label="S" value=${s} min=0 max=100
        gradient=${'linear-gradient(to right,hsl('+h+' 0% '+l+'%),hsl('+h+' 100% '+l+'%)'}
        onChange=${v => set('s', v)} />
      <${Slider} label="L" value=${l} min=0 max=100
        gradient=${'linear-gradient(to right,hsl('+h+' '+s+'% 0%),hsl('+h+' '+s+'% 50%),hsl('+h+' '+s+'% 100%)'}
        onChange=${v => set('l', v)} />
      <${CopyRows} value=${color.value} />
    </div>`;
}
// ── Tab: LCH
function LCHTab() {
  let lch = toLch(color.value);
  let l   = +((lch.l ?? 0)).toFixed(1);
  let c   = +((lch.c ?? 0)).toFixed(2);
  let h   = Math.round(lch.h ?? 0);
  let set = (ch, v) => color.value = toOklch({ ...toLch(color.value), [ch]: v });

  return html`
    <div class="tab-content">
      <${Slider} label="L" value=${l} min=0 max=100   step=0.1 onChange=${v => set('l', v)} />
      <${Slider} label="C" value=${c} min=0 max=150   step=0.1 onChange=${v => set('c', v)} />
      <${Slider} label="H" value=${h} min=0 max=360
        gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
        onChange=${v => set('h', v)} />
      <${CopyRows} value=${color.value} />
    </div>`;
}
// ── Tab: OKLCH
function OKLCHTab() {
  let { l = 0, c = 0, h = 0 } = color.value;
  let lp = +l.toFixed(4);
  let cp = +c.toFixed(4);
  let hp = Math.round(h);

  let set = (ch, v) => color.value = { ...color.value, mode: 'oklch', [ch]: v };

  return html`
    <div class="tab-content">
      <${Slider} label="L" value=${lp} min=0 max=1     step=0.001 onChange=${v => set('l', v)} />
      <${Slider} label="C" value=${cp} min=0 max=0.4   step=0.001 onChange=${v => set('c', v)} />
      <${Slider} label="H" value=${hp} min=0 max=360
        gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
        onChange=${v => set('h', v)} />
      <${CopyRows} value=${color.value} />
    </div>`;
}
// ── Tab: Mix
let MIX_SPACES = ['rgb', 'hsl', 'oklch', 'lch', 'lab', 'oklab'];
function MixTab() {
  let [a,   setA]   = useState(toHex(color.value));
  let [b,   setB]   = useState('#ffffff');
  let [pct, setPct] = useState(50);
  let [sp,  setSp]  = useState('oklch');

  let safeA = parse(a);
  let safeB = parse(b);
  if (!safeA || !safeB) return html`<div class="tab-content"><span class="placeholder">Enter two valid hex colors</span></div>`;
  let mixed, mixHex;
  try {
    mixed  = interpolate([safeA, safeB], sp)(pct / 100);
    mixHex = toHex(mixed);
  } catch {
    mixHex = '#000000';
  }
  let cssStr     = `color-mix(in ${sp}, ${a} ${pct}%, ${b})`;

  let ColorInput = ({ value, onChange }) => html`
    <div class="mix-color">
      <${Swatch} hex=${value} size="lg" />
      <input class="field hex-input" type="text" maxlength="7" value=${value}
        onInput=${e => { if (parse(e.target.value)) onChange(e.target.value); }} />
      <input type="color" class="native-color" value=${value}
        onInput=${e => onChange(e.target.value)} />
    </div>`;

  return html`
    <div class="tab-content">
      <div class="mix-row">
        <${ColorInput} value=${a} onChange=${setA} />
        <button class="swap-btn" onClick=${() => { setA(b); setB(a); }} title="Swap">
          <${Icon} name="mdi:swap-horizontal" />
        </button>
        <${ColorInput} value=${b} onChange=${setB} />
      </div>
      <${Slider} label="Mix" value=${pct} min=0 max=100
        gradient=${'linear-gradient(to right,'+a+','+b+')'}
        onChange=${setPct} />
      <div class="space-picker">
        ${MIX_SPACES.map(s => html`
          <button class=${'fmt-btn'+(sp===s?' active':'')} onClick=${() => setSp(s)}>${s}</button>`)}
      </div>
      <div class="mix-result">
        <${Swatch} hex=${mixHex} size="lg" />
        <${CopyRows} value=${mixed}>
          <${CopyRow} label="color-mix" value=${cssStr} />
        </${CopyRows}>
      </div>
    </div>`;
}
// ── Tab: Shades
function ShadesTab() {
  let [steps, setSteps] = useState(10);
  let [name,  setName]  = useState('color');
  let base   = color.value;
  let shades = Array.from({ length: steps }, (_, i) => {
    let t = i / (steps - 1);
    return toHex({ ...base, mode: 'oklch', l: clamp(0.96 - t * 0.88, 0.05, 0.97) });
  });
  let cssVars = shades.map((hex, i) => `--${name || 'color'}-${(i + 1) * Math.round(1000 / steps)}: ${hex};`).join('\n');
  
  return html`
    <div class="tab-content">
      <div class="shade-controls">
        <${Slider} label="Steps" value=${steps} min=3 max=20 onChange=${setSteps} />
        <div class="slider-row">
          <span class="slider-label">Name</span>
          <input class="field hex-input" type="text" value=${name} onInput=${e => setName(e.target.value)} />
        </div>
      </div>
      <div class="shade-grid">
        ${shades.map((hex, i) => html`
          <div class="shade-item" onClick=${() => navigator.clipboard.writeText(hex)} title="Copy">
            <div class="swatch swatch-shade" style=${{ background: hex }} />
            <span class="shade-hex">${hex}</span>
            <span class="shade-num">${(i + 1) * Math.round(1000 / steps)}</span>
          </div>`)}
      </div>
      <div class="copy-rows" style="margin-top:.5rem">
        <div class="copy-row copy-row-vars">
          <span class="copy-label">css</span>
          <textarea class="vars-textarea" readonly style=${{ '--lines': steps }}>${cssVars}</textarea>
          <button class="ghost-btn" onClick=${() => navigator.clipboard.writeText(cssVars)}>
            <${Icon} name="mdi:content-copy" />
          </button>
        </div>
      </div>
    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  let hex      = toHex(color.value);
  let Active   = TAB_MAP[tab.value];
  return html`
    <div id="app-body">

      <div class="color-header">
        <div class="header-swatch" style=${{ background: hex }} />
        <code class="header-hex" onClick=${() => navigator.clipboard.writeText(hex)}>${hex}</code>
      </div>

      <div class="tab-bar">
        ${TABS.map(t => html`
          <button class=${'tab-btn'+(tab.value===t?' active':'')} onClick=${() => tab.value = t}>${t}</button>`)}
      </div>
      
      <div class='tab'>
        <${Active} />
      </div>

    </div>`;
}

boot({ config, App });
