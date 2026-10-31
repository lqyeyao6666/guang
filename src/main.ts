import {installQuantumUI,updateQuantumUI,updateQuantumCounts} from './quantum-ui.ts';
import {advanceQuantumExperiment} from './quantum-optics.ts';
import './style.css';
import './music.css';
import { canPlace, createLevel, SPECTRUM, levelSummaries, moveItem, rotateItem, storeItem, snapItemPosition } from './level.ts';
import { advanceAquariumGate } from './refraction-optics.ts';
import './refraction.css';
import './photoelectric.css';
import './quantum.css';
import { installPhotoelectricUI,updatePhotoelectricUI } from './photoelectric-ui.ts';
import { PHOTO_WAVELENGTHS } from './photoelectric-level.ts';
import { forestVisible } from './forest-path.ts';
import { advanceHerds, cowAtHome, herdCow } from './rural-rules.ts';
import type { Item, ItemKind, LevelNumber, Point } from './level.ts';
import { isLightReady, traceLevel, spectrumProgress, waypointProgress, WinGate } from './optics.ts';
import { GameScene } from './scene.ts';
import { StartScreen } from './start-screen.ts';
import { GameHud } from './game-hud.ts';
import { GameProgress, nextPlayable, progressStorageKey } from './progress.ts';
import { JourneyMenu } from './journey-menu.ts';
import { installCreatorCredits } from './credits.ts';
import './game-shell.css';
import { Storybook } from './storybook.ts';
import { ChapterSpirit } from './chapter-spirit.ts';
import { ChapterMusic } from './music.ts';
import { SoundEffects } from './sfx.ts';
import { CUBE_FACES } from './cube-space.ts';
import './cube.css';
import { defaultSettings, loadSettings, normalizeSettings, saveSettings } from './settings.ts';

const paths: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  hint: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
  beamSplitter: '<path d="M5 19 19 5M3 12h18M12 3v18"/>',
  photonSource: '<circle cx="10" cy="12" r="4"/><path d="M16 12h6m-3-3 3 3-3 3"/>',
  photonDetector: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 16v-3m4 3V8m4 8v-5"/>',
  mirror: '<path d="M7 18 17 6M5 18h4m6-12h4M5 8h5m4 8h5"/>',
  lens: '<path d="M12 3c-6 4-6 14 0 18 6-4 6-14 0-18ZM2 12h6m8 0h6"/>',
  concaveLens: '<path d="M7 3h10c-4 6-4 12 0 18H7c4-6 4-12 0-18ZM2 12h5m10 0h5"/>',
  hay: '<path d="m5 20-1-9 8-8 8 8-1 9ZM5 12h14M5 16h14M12 4v16M9 7 7 20m8-13 2 13"/>',
  lock: '<rect x="6" y="10" width="12" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  right: '<path d="M21 10a9 9 0 1 0-2 8m2-14v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  leaf: '<path d="M20 4C7 2 2 7 6 16c9 4 14-1 14-12ZM6 18l9-9"/>',
  settings: '<path d="m10 3-1 3-3 1-3 1 1 4-1 4 3 1 3 1 1 3h4l1-3 3-1 3-1-1-4 1-4-3-1-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M6 9h12M12 2v7"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4M12 11v11M7 5l10 4"/>',
  liftMirror: '<path d="M4 18h16M6 16 18 5M12 13V3m-4 4 4-4 4 4"/>',
  balloonMirror: '<ellipse cx="12" cy="6" rx="5" ry="5"/><path d="m11 11 1 2 1-2M12 13v5M5 21l14-4M12 16h9m-3-3 3 3-3 3"/>',
  block: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 4v5h6V4"/>',
  prism: '<path d="m4 19 8-15 8 15ZM2 12h6m8-3 6-4m-6 7h6m-6 3 6 4"/>',
  colorWaypoint: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  waypoint: '<circle cx="12" cy="12" r="7"/><path d="M2 12h20M12 2v20m-3-3 3 3 3-3M18 9l3 3-3 3"/>',
};
const icon = (name: string) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sun}</svg>`;
const kinds: { kind: ItemKind; name: string; icon: string }[] = [
  {kind:'beamSplitter',name:'半透半反镜',icon:'beamSplitter'},
  {kind:'photonSource',name:'单光子源',icon:'photonSource'},
  {kind:'photonDetector',name:'计数探测器',icon:'photonDetector'},
  { kind:'coreMirror',name:'向心分光镜',icon:'liftMirror' },
  { kind:'photocell',name:'感光板',icon:'focus' },
  { kind:'cubeWaypoint',name:'六面途经点',icon:'waypoint' },
  { kind: 'prism', name: '三棱镜', icon: 'prism' },
  { kind: 'block', name: '挡光块', icon: 'block' },
  { kind: 'mirror', name: '平面镜', icon: 'mirror' }, { kind: 'lens', name: '凸透镜', icon: 'lens' },
  { kind: 'concaveLens', name: '凹透镜', icon: 'concaveLens' }, { kind: 'hay', name: '稻草堆', icon: 'hay' },
  { kind: 'liftMirror', name: '向上反射镜', icon: 'liftMirror' }, { kind: 'balloonMirror', name: '红气球镜', icon: 'balloonMirror' },
  { kind: 'source', name: '光源', icon: 'sun' }, { kind: 'beacon', name: '终点信标', icon: 'hint' },
  { kind: 'waypoint', name: '双向途经点', icon: 'waypoint' },
];
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="game-layout">
    <section class="play-area" aria-label="第一关游戏区域">
      <div class="level-heading"><div><div class="eyebrow"><span id="chapter-heading"></span><i></i><span id="level-number"></span></div><h2 id="level-title"></h2><p id="level-introduction"></p></div><div class="header-actions" aria-label="游戏工具"><button class="quiet-button" id="return-home" aria-label="返回主界面"><span>返回主界面</span></button><button class="quiet-button" id="open-settings">${icon('settings')}<span>设置</span></button><button class="quiet-button" id="restart">${icon('reset')}<span>重新开始</span></button></div></div>
      <div id="scene" class="scene"><div class="night-atmosphere" aria-hidden="true"><span class="moon"></span><span class="night-caption">星光很远，灯火就在前方。</span></div>
        <div class="scene-topline"><span class="board-label">光之庭院 <i>7 × 7</i></span><span class="scene-mode">${icon('right')}拖动空白处，绕中心旋转</span></div>
        <div id="layer-controls" class="layer-controls" hidden aria-label="棋盘分层操作"><div class="layer-buttons"><button id="edit-lower" type="button">操作下层</button><button id="edit-upper" type="button">操作上层</button><button id="layer-overview" type="button">双层全景</button><button id="show-layer-guide" class="layer-guide-help" type="button" aria-label="查看分层操作引导" title="查看分层操作引导">?</button></div><p id="layer-note" role="status"></p></div>
        <div id="world-labels" aria-hidden="true"><span class="world-label" data-item="source">光源</span><span class="world-label" data-item="beacon">终点</span><span class="world-label fixed-label" data-item="fixed">${icon('lock')}固定</span></div>
        <div id="loading" class="loading">${icon('sun')}正在点亮小径…</div>
        <div class="scene-toolbar"><div class="zoom-controls"><button id="zoom-out" aria-label="缩小视野">${icon('minus')}</button><span id="zoom-value">100%</span><button id="zoom-in" aria-label="放大视野">${icon('plus')}</button></div><div id="selection-status" class="selection-status">${icon('mouse')}右键点击器件，选择朝向</div><button id="reset-view" class="view-reset">${icon('focus')}<span>视角复位</span></button></div>
        <div id="toast" class="toast" role="status"></div>
        <div id="celebration" class="celebration" hidden><span>${icon('sun')}</span><div><small>LEVEL COMPLETE</small><strong id="completion-title">光，找到归途了。</strong><p id="completion-text"></p><button id="next-level" class="primary-button">下一关 · 把光聚拢 →</button></div><button id="continue" aria-label="收起通关提示">${icon('close')}</button></div>
      </div>
    </section>
    <aside class="sidebar" aria-label="信标与物品栏">
      <section class="receiver-card"><div class="card-top"><span class="eyebrow">终点信标</span><span id="signal-badge" class="status-badge">等待光线</span></div><div class="receiver-body"><div class="energy-gauge"><svg viewBox="0 0 180 180" aria-hidden="true"><circle class="gauge-track" cx="90" cy="90" r="72"/><circle class="gauge-fill" id="gauge-fill" cx="90" cy="90" r="72"/></svg><strong id="energy-value">0<span>%</span></strong></div><div class="receiver-detail"><p>接收强度 <b id="signal-target"></b></p><div class="charge-track"><span id="charge-fill"></span></div><p id="signal-text" role="status"></p></div></div></section>
      <section id="inventory" class="inventory-card" aria-label="物品栏，可拖出或放回器件"><div class="card-top"><h3>${icon('box')}物品栏</h3><span class="inventory-legend">可用 / 总数</span></div><p class="inventory-instruction">拖到棋盘上，也可以拖回来。</p><div class="inventory-items">${kinds.map(entry => `<button type="button" class="inventory-row ${entry.kind}" data-kind="${entry.kind}" aria-label="${entry.name}"><span class="item-thumbnail">${icon(entry.icon)}</span><span class="inventory-name"><strong>${entry.name}</strong><small data-detail="${entry.kind}"></small></span><span class="inventory-count"><b data-count="${entry.kind}">0</b><span data-total="${entry.kind}"></span></span></button>`).join('')}</div><div id="return-zone" class="return-zone">${icon('box')}<span>将可移动器件拖回这里收纳</span></div></section>
      <section class="journey-card"><div class="card-top"><h3>让光走一小段路</h3><span id="step-count" class="tiny-count">0 / 3</span></div><div id="waypoint-status" class="waypoint-status" hidden role="status"><span>${icon('waypoint')}双向途经 <b id="waypoint-value">0 / 2</b></span><p id="waypoint-detail"></p></div><div id="spectrum-status" class="spectrum-status" hidden role="status"><div><span>七色区域</span><b id="spectrum-value">0 / 7</b></div><div class="spectrum-chips"><span data-spectrum="red" style="--band:#ee746b"><i></i>红<small>待接</small></span><span data-spectrum="orange" style="--band:#f5aa59"><i></i>橙<small>待接</small></span><span data-spectrum="yellow" style="--band:#e9c94f"><i></i>黄<small>待接</small></span><span data-spectrum="green" style="--band:#79bb83"><i></i>绿<small>待接</small></span><span data-spectrum="cyan" style="--band:#52bec4"><i></i>青<small>待接</small></span><span data-spectrum="blue" style="--band:#739bea"><i></i>蓝<small>待接</small></span><span data-spectrum="violet" style="--band:#b18bd9"><i></i>紫<small>待接</small></span></div><p>各区同色点 → 汇虹台 · 七路须同时抵达</p></div><div id="fusion-status" class="fusion-status" hidden role="status"><div class="fusion-recipe" data-route="yellow"><b>红＋绿 → 黄</b><span>合成黄＋原生黄 → 增强黄</span><small></small></div><div class="fusion-recipe" data-route="cyan"><b>绿＋蓝 → 青</b><span>合成青＋原生青 → 增强青</span><small></small></div><p>绿光分流 ↑→ 各半 · 合光器自动平衡色比<br>原生光单独照圆环无效 · 交叉不自动混色<br>挡住杂色 → 两个增强圆环 → 中央合束</p></div><div class="steps"><span id="step-mirror">① 转向</span><i>—</i><span id="step-fixed">② 反射</span><i>—</i><span id="step-focus">③ 聚焦</span></div><button id="hint" class="hint-button">${icon('hint')}<span>给我一点灵感</span><b>＋</b></button><p id="hint-content" class="hint-content" hidden role="status"></p></section>
    </aside>
  </main>
  <div id="rotation-menu" class="rotation-menu" role="menu" aria-label="器件旋转菜单" hidden></div>
  <div id="drag-badge" class="drag-badge" aria-hidden="true" hidden></div>
  <div id="layer-guide" class="layer-guide" role="dialog" aria-modal="true" aria-labelledby="layer-guide-title" aria-describedby="layer-guide-description" hidden><div id="layer-guide-card" class="layer-guide-card"><span class="guide-eyebrow">先认识一下 · 分层操作</span><h2 id="layer-guide-title">挡住了？让另一层暂时透明。</h2><div id="layer-guide-description"><p><b>操作下层</b><span>上层棋盘和道具变透明，方便摆放下层器件。</span></p><p><b>操作上层</b><span>下层变透明，方便摆放上层器件。</span></p><p><b>双层全景</b><span>看完整结构；选择一层后继续操作。</span></p></div><button id="dismiss-layer-guide" class="primary-button" type="button">明白了，开始探索</button><small>单击任意位置即可收起 · 可点 ? 再次查看</small></div></div>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="settings-heading"><div><div class="eyebrow">PREFERENCES</div><h2 id="settings-title">设置</h2></div><button id="close-settings" class="close-button" aria-label="关闭设置">${icon('close')}</button></div><div class="settings-section"><h3>${icon('focus')}视角</h3><label class="setting-label" for="pitch">俯视角度 <output id="pitch-value" for="pitch">53°</output></label><input id="pitch" type="range" min="30" max="85" step="1"/><div class="range-labels"><span>30° · 更低的视角</span><span>85° · 接近正上方</span></div><label class="setting-label" for="rotation-speed">旋转灵敏度 <output id="rotation-speed-value" for="rotation-speed">100%</output></label><input id="rotation-speed" type="range" min="50" max="150" step="5"/><div class="range-labels"><span>缓慢</span><span>灵活</span></div></div><div class="settings-section music-section"><h3>${icon('sun')}音乐</h3><div class="music-setting"><div><label for="music-enabled">背景音乐</label><small>三章各有一首，陪光慢慢前行。</small></div><input id="music-enabled" class="music-switch" type="checkbox" role="switch"/></div><label class="setting-label" for="music-volume">音乐音量 <output id="music-volume-value" for="music-volume">50%</output></label><input id="music-volume" type="range" min="0" max="100" step="1"/><div class="range-labels"><span>轻轻的</span><span>更清晰</span></div><p id="music-status" class="music-status" role="status"></p></div><div class="settings-section music-section"><h3>${icon('mouse')}操作反馈</h3><div class="music-setting"><div><label for="sound-effects-enabled">操作音效</label><small>轻柔的点击、旋转、拿起和放置提示。</small></div><input id="sound-effects-enabled" class="music-switch" type="checkbox" role="switch"/></div></div><p id="settings-saved" class="settings-saved">设置实时生效，并自动保存在本机。</p><div class="settings-actions"><button id="reset-settings" class="quiet-button">恢复默认设置</button><button id="done-settings" class="primary-button">完成</button></div></dialog>
`;

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
element('waypoint-status').insertAdjacentHTML('beforebegin', '<div id="rural-status" class="rural-status" hidden><span>稻草已挪开 <b id="hay-progress">0/3</b></span><span>牛已回圈 <b id="cow-progress">0/2</b></span><span>幕布覆盖 <b id="screen-progress">0%</b></span></div>');
const stage = element('scene');
const inventory = element('inventory');
const menu = element('rotation-menu');
const settingsDialog = element<HTMLDialogElement>('settings-dialog');
installCreatorCredits(settingsDialog);
const dragBadge = element('drag-badge');
const layerGuide = element('layer-guide');
element('layer-controls').insertAdjacentHTML('afterend', `<section id="cube-controls" class="cube-controls" aria-label="立方体六面操作" hidden><div class="cube-face-buttons">${CUBE_FACES.map((face,layer)=>`<button type="button" data-cube-face="${layer}" aria-label="操作${face.name}">${face.name}<i>○</i></button>`).join('')}<button type="button" id="cube-overview">立方全景</button><button type="button" id="cube-guide" aria-label="查看立方体操作引导">?</button></div><div class="cube-control-note"><p id="cube-note" role="status"></p><button type="button" id="cube-hide-others" aria-pressed="true">其余五面已隐藏</button></div></section>`);
element('waypoint-status').insertAdjacentHTML('beforebegin',`<div id="cube-status" class="cube-status" role="status" hidden><div><span>六面途经 → 光心</span><b id="cube-progress">0 / 6</b></div><div class="cube-progress-faces">${CUBE_FACES.map((face,layer)=>`<button type="button" data-cube-jump="${layer}"><span>${face.name}</span><small>待接</small></button>`).join('')}</div></div>`);
const progress = new GameProgress();
function levelFromUrl(): LevelNumber {
  const requested = new URL(location.href).searchParams.get('level');
  return levelSummaries.find(entry => String(entry.number) === requested)?.number ?? (requested === null ? nextPlayable(progress.data) : 1);
}
element('waypoint-status').insertAdjacentHTML('beforebegin','<div id="refraction-status" class="refraction-status" hidden role="status"><div><b>水中折射</b><span id="water-progress">等待入水</span></div><div><b>光控门</b><span id="gate-progress">等待感应</span></div><div><b>滑轨接力</b><span id="rail-progress">0 / 4</span></div><div><b>两枚观测环</b><span id="observation-progress">0 / 2</span></div><p>A 镜先照感应器，再调整接力。<br>拖动滑轨镜吸附刻度；右键调整镜面。</p></div>');
const requestedLevel = levelFromUrl();
const blockedEntry = new URL(location.href).searchParams.has('level') && !progress.canPlay(requestedLevel);
if (blockedEntry) { const url = new URL(location.href); url.searchParams.delete('level'); history.replaceState(null, '', url); }
let level = createLevel(progress.canPlay(requestedLevel) ? requestedLevel : nextPlayable(progress.data));
let trace = traceLevel(level);
let selectedId: string | null = null;
let hintStep = 0;
let moves = 0;
let toastTimer = 0;
let settings = loadSettings();
let inHome = !new URL(location.href).searchParams.has('level');
let hasStarted = !inHome;
let home: StartScreen | undefined;
let resumeLayerGuide = false;
const gate = new WinGate();
let view: GameScene;
try { view = new GameScene(stage, level); }
catch (error) {
  element('loading').innerHTML = '<strong>暂时无法打开 3D 棋盘</strong><p>请在 Chrome 或 Edge 中启用图形加速。</p>';
  throw error;
}
element('loading').remove();
stage.append(element('hint-content'));
stage.before(element('layer-controls'));
stage.before(element('cube-controls'));
installPhotoelectricUI(stage);
installQuantumUI(stage);
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-wavelength]'))button.addEventListener('click',()=>{
  if(!level.photoelectric||inHome)return;
  const wavelength=Number(button.dataset.wavelength);
  if(!PHOTO_WAVELENGTHS.some(w=>w.nm===wavelength))return;
  cancelGesture();closeMenu();level.photoelectric.wavelengthNm=wavelength;recalculate();
});
element('photo-intensity').addEventListener('input',event=>{
  if(!level.photoelectric||inHome)return;
  cancelGesture();closeMenu();level.photoelectric.intensity=Math.max(.25,Math.min(1,Number((event.target as HTMLInputElement).value)/100));recalculate();
});
view.setSettings(settings);
const music = new ChapterMusic(settings, level.chapter, updateMusicStatus);
const soundEffects = new SoundEffects(settings.soundEffectsEnabled);
const chapterSpirit = new ChapterSpirit(stage);
const storybook = new Storybook(() => { cancelGesture(); closeMenu(); dismissLayerGuide(); chapterSpirit.close(); });

interface Gesture {
  pointerId: number;
  capture: HTMLElement;
  itemId: string | null;
  fromInventory: boolean;
  offset: Point;
  start: Point;
  last: Point;
  dragged: boolean;
  valid: boolean;
  overInventory: boolean;
  candidate: Point | null;
}
let gesture: Gesture | null = null;
let suppressDragClickUntil = 0;
const containsPoint = (host: HTMLElement, point: Point) => {
  const bounds = host.getBoundingClientRect();
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
};

const hud = new GameHud(stage, {
  onExpand: () => { cancelGesture(); closeMenu(); chapterSpirit.close(); },
  onInsets: (top, bottom) => view.setViewportInsets(top, bottom),
});

function toast(message: string): void {
  clearTimeout(toastTimer);
  element('toast').textContent = message;
  element('toast').classList.add('visible');
  toastTimer = window.setTimeout(() => element('toast').classList.remove('visible'), 2400);
}

function updateInventory(): void {
  for (const entry of kinds) {
    const items = level.items.filter(item => item.kind === entry.kind && (entry.kind !== 'block' || item.movable));
    const available = items.filter(item => item.inInventory).length;
    const fixed = items.filter(item => !item.movable).length;
    const row = inventory.querySelector<HTMLElement>(`[data-kind="${entry.kind}"]`)!;
    const name = level.photoelectric && entry.kind === 'source' ? '双区灯源' : level.aquarium && entry.kind === 'waypoint' ? '观测环' : level.setting === 'school' && entry.kind === 'block' ? '可搬书箱' : level.setting === 'school' && entry.kind === 'waypoint' ? '桌下与讲台' : (level.setting || level.theme === 'experiment') && (entry.kind === 'beacon' || entry.kind === 'source') ? items[0]?.name ?? entry.name : level.theme === 'night' && entry.kind === 'beacon' ? '夜航灯塔' : level.theme === 'night' && entry.kind === 'source' ? '白光小灯' : entry.name;
    row.querySelector('strong')!.textContent = name;
    row.hidden = items.length === 0;
    row.querySelector('[data-count]')!.textContent = String(available);
    row.querySelector('[data-total]')!.textContent = ` / ${items.length}`;
    row.querySelector('[data-detail]')!.textContent = `棋盘 ${items.length - available} · 固定 ${fixed}`;
    row.classList.toggle('empty', available === 0);
    row.setAttribute('aria-disabled', String(available === 0));
    row.setAttribute('aria-label', `${name}，可用 ${available}，总数 ${items.length}，固定 ${fixed}`);
    row.title = `${name} · 可用 ${available} / ${items.length}${fixed === items.length ? ' · 固定' : ''}`;
  }
}

function updateSelection(): void {
  const item = level.items.find(candidate => candidate.id === selectedId && !candidate.inInventory);
  element('selection-status').innerHTML = item
    ? `${icon(item.rotatable ? 'mouse' : 'lock')}<span>${item.name} · ${item.kind === 'cow' ? cowAtHome(item) ? '已回圈' : item.herdPath ? '正在回圈' : '点击赶回牛圈' : !view.isVisible(item) ? '光照外 · 拖回物品栏可回收' : item.rotatable ? `${item.angle}° · 右键调整` : item.movable ? '拖动搬开 · 可收纳' : '已固定'}</span>`
    : `${icon('mouse')}<span>右键点击器件，选择朝向</span>`;
  view.select(item?.id ?? null);
  if(item?.rail)element('selection-status').innerHTML=`${icon('move')}<span>${item.name} · 沿轨拖动 · ${item.angle}°</span>`;
}

function updateSignal(): void {
  const waypoint = level.items.find(item => item.kind === 'waypoint');
  const progress = waypoint && !level.aquarium ? waypointProgress(level, trace, waypoint.id) : null;
  const spectrum = level.theme === 'experiment' && !level.fusion && !level.aquarium && !level.photoelectric && !level.quantum ? spectrumProgress(level, trace) : null;
  const fusion = trace.fusion;
  const energy = (level.cube || waypoint || spectrum || fusion ? trace.qualifiedReceived.beacon : trace.received.beacon) ?? 0;
  const sufficient = isLightReady(level, trace);
  const rural = level.setting === 'rural';
  const projection = (trace.projections.beacon ?? []).reduce<(typeof trace.projections.beacon)[number] | undefined>((best, pass) => !best || pass.coverage > best.coverage ? pass : best, undefined);
  const cowsHome = level.items.filter(cowAtHome).length;
  const initialHay = rural ? createLevel(level.number).items.filter(item => item.kind === 'hay') : [];
  const hayMoved = level.items.filter(item => item.kind === 'hay' && (item.inInventory || !initialHay.some(initial => initial.id === item.id && initial.x === item.x && initial.y === item.y))).length;
  element('rural-status').hidden = !rural;
  if (rural) {
    element('hay-progress').textContent = `${hayMoved}/3`;
    element('cow-progress').textContent = `${cowsHome}/2`;
    element('screen-progress').textContent = `${Math.round((projection?.coverage ?? 0) * 100)}%`;
    for (const cow of level.items.filter(item => item.kind === 'cow')) {
      const label = document.querySelector(`[data-item="${cow.id}"]`);
      if (label) label.textContent = `${cow.name} · ${cowAtHome(cow) ? '已回圈' : cow.herdPath ? '回圈中' : '点击回圈'}`;
    }
  }
  element('energy-value').innerHTML = `${Math.round(energy * 100)}<span>%</span>`;
  element('signal-badge').textContent = rural ? sufficient ? '准备开映' : cowsHome < 2 ? '等牛回圈' : projection && (!projection.spread || projection.coverage < 0.999) ? '画面未展开' : '等待放映' : spectrum ? `${spectrum.filter(color => color.arrived).length} / 7 色抵达` : sufficient ? '光芒充足' : energy > 0 ? '强度不足' : '等待光线';
  element('signal-badge').classList.toggle('lit', sufficient);
  element('cube-status').hidden=!level.cube;
  if(trace.cube) {
    const arrived=trace.cube.faces.filter(face=>face.arrived).length;
    element('cube-progress').textContent=`${arrived} / 6`;
    for(const face of trace.cube.faces) {
      const chip=document.querySelector<HTMLElement>(`[data-cube-jump="${face.layer}"]`)!;
      chip.classList.toggle('passed',face.passed);chip.classList.toggle('arrived',face.arrived);
      chip.querySelector('small')!.textContent=face.arrived ? '抵达 ✓' : face.passed ? '已途经' : '待接';
      const button=document.querySelector<HTMLElement>(`[data-cube-face="${face.layer}"]`)!;
      button.classList.toggle('arrived',face.arrived);button.querySelector('i')!.textContent=face.arrived ? '✓' : face.passed ? '◦' : '○';
      const label=document.querySelector<HTMLElement>(`[data-item="cube-point-${face.layer}"]`);
      if(label) label.textContent=`${face.name}途经 · ${face.arrived ? '✓' : face.passed ? '已过' : '○'}`;
    }
  }
  element('signal-text').innerHTML = rural
    ? sufficient ? '幕布亮了，<br>男女老少一起坐下看电影。' : cowsHome < 2 ? '拖开稻草，点击牛回圈，<br>再沿空出的村路接起白光。' : projection?.spread && projection.coverage >= 0.999 ? '画面已展开，<br>靠近一点，留住足够亮度。' : '用末段的凹透镜展开光，<br>让整幅幕布都亮起来。'
    : spectrum
    ? sufficient ? '七色一起抵达，<br>天空正在架起彩虹桥。' : '先经过同色圆环，<br>再让七束光一起抵达汇虹台。'
    : progress
    ? sufficient ? '两路双向经过，<br>一起把终点点亮了。' : progress.complete ? '两路都已抵达，<br>用两枚凸透镜分别聚焦。' : '两束光各从不同方向途经，<br>然后都要继续抵达终点。'
    : level.setting === 'forest'
    ? sufficient ? '火光已找到家，<br>窗里有暖意，路上有归人。' : '亮处试着转一面镜子，<br>让火光探出下一段归途。'
    : level.setting === 'street'
    ? sufficient ? '路边亮起来了，<br>忙了一早，坐下吃口热的吧。' : '花箱和围挡会挡住光，<br>把阳台的灯送到路边早餐。'
    : level.layers === 2
    ? sufficient ? '光已上楼并聚拢，<br>云上的回信就要亮起。' : '从下层穿过洞口，<br>再让上层的光聚拢到信标。'
    : level.theme === 'night'
    ? sufficient ? '航线已接通，<br>灯塔将为小船点亮方向。' : '借助两面固定镜，<br>用三面镜子接通夜航灯塔。'
    : level.number === 1
    ? sufficient ? '两次反射接通了，<br>信标正在亮起。' : '固定镜让光向上走，<br>再让你的镜子把光送向信标。'
    : sufficient ? '光已聚拢，信标正在亮起。' : energy > 0 ? '已照到，强度不足。<br>让透镜的焦点落在信标上。' : '这次需要更亮的光，<br>用凸透镜把光聚拢到信标。';
  element('fusion-status').hidden = !fusion;
  if (fusion) {
    element('signal-badge').textContent = sufficient ? '双路合束就绪' : `${Number(fusion.yellow.passed)+Number(fusion.cyan.passed)} / 2 增强途经`;
    element('signal-text').innerHTML = sufficient ? '实验完成，<br>云端发射台正在启动。' : '合成光与原生同色光增强，<br>经过两个圆环，再合束到发射台。';
    for (const route of ['yellow','cyan'] as const) {
      const status = fusion[route];
      const card = document.querySelector<HTMLElement>(`[data-route="${route}"]`)!;
      const contaminated = ['mix-'+route,'boost-'+route,'split-green'].some(id => fusion.nodes[id]?.contaminated);
      card.classList.toggle('active',status.passed); card.classList.toggle('contaminated',contaminated);
      card.querySelector('small')!.textContent = contaminated ? '混入杂色 · 请挡光' : status.arrived ? '增强 ✓ · 途经 ✓ · 合束抵达 ✓' : status.passed ? '增强 ✓ · 途经 ✓ · 等待合束' : status.boosted ? '增强 ✓ · 还需途经圆环' : status.mixed ? '合成 ✓ · 等待同色增强' : '等待两色合成';
      card.querySelector('small')!.dataset.short = contaminated ? '有杂色 · 请挡光' : status.arrived ? '已合束抵达 ✓' : status.passed ? '已途经 · 待合束' : status.boosted ? '已增强 · 待途经' : status.mixed ? '已合成 · 待增强' : '等待合成';
      const label = document.querySelector<HTMLElement>(`[data-item="power-${route}"]`);
      if (label) { label.textContent = `增强${route === 'yellow' ? '黄' : '青'} ${status.passed ? '✓' : '○'}`; label.classList.toggle('arrived',status.arrived); }
    }
    for (const [id,node] of Object.entries(fusion.nodes)) {
      const label = document.querySelector<HTMLElement>(`[data-item="${id}"]`);
      label?.classList.toggle('node-active',node.active); label?.classList.toggle('node-contaminated',node.contaminated);
    }
  }
  element('waypoint-status').hidden = !progress;
  if (progress && level.setting !== 'school') {
    const count = Math.min(progress.directions.length, progress.sources.length, 2);
    const directions = progress.directions.map(angle => ({ 0: '左侧', 90: '上侧', 180: '右侧', 270: '下侧' } as Record<number, string>)[angle] ?? `${angle}°来向`);
    element('waypoint-value').textContent = `${count} / 2`;
    element('waypoint-detail').textContent = `${directions.length ? `已从${directions.join('、')}经过` : '等待两个不同来向'} · 抵达 ${Math.min(progress.deliveredSources.length, 2)}/2`;
    element('waypoint-status').classList.toggle('complete', progress.complete);
    document.querySelector<HTMLElement>('[data-item="waypoint"]')!.textContent = `途经点 · ${count}/2`;
  }
  if (level.setting === 'school') {
    const points = level.items.filter(item => item.kind === 'waypoint');
    const passed = points.filter(item => (trace.waypointPasses[item.id] ?? []).length > 0).length;
    const arrived = points.filter(item => waypointProgress(level, trace, item.id).complete).length;
    element('waypoint-value').textContent = `${arrived} / 3`;
    element('waypoint-detail').textContent = `已穿过 ${passed}/3 · 继续抵达应急灯 ${arrived}/3`;
    element('waypoint-status').classList.toggle('complete', arrived === 3);
    element('signal-badge').textContent = sufficient ? '准备复课' : `通道抵达 ${arrived}/3`;
    element('signal-text').innerHTML = sufficient ? '教室正在亮起来，<br>同学们可以继续学习了。' : '同一束光穿过两处桌下与讲台，<br>再聚焦到应急灯。';
    for (const item of points) {
      const done = waypointProgress(level, trace, item.id).complete;
      const label = document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);
      if (label) { label.textContent = `${item.name} · ${done ? '✓' : (trace.waypointPasses[item.id] ?? []).length ? '已过' : '○'}`; label.classList.toggle('arrived',done); }
    }
  }
  element('spectrum-status').hidden = !spectrum;
  if (spectrum) {
    element('spectrum-value').textContent = `${spectrum.filter(color => color.arrived).length} / 7`;
    for (const color of spectrum) {
      const chip = document.querySelector<HTMLElement>(`[data-spectrum="${color.id}"]`)!;
      const region = level.colorRegions?.find(region => region.color === color.id);
      chip.title = `${color.name}色区域 · ${region?.name ?? ''}`;
      chip.classList.toggle('passed', color.passed); chip.classList.toggle('arrived', color.arrived);
      chip.querySelector('small')!.textContent = color.arrived ? '抵达' : color.passed ? '途经' : '待接';
      const label = document.querySelector<HTMLElement>(`[data-item="color-${color.id}"]`);
      if (label) { label.textContent = `${color.name} · ${color.arrived ? '✓' : color.passed ? '经过' : '○'}`; label.classList.toggle('arrived', color.arrived); }
    }
  }
  if(trace.cube) {
    element('signal-badge').textContent=sufficient ? '六面光已汇合' : `${trace.cube.faces.filter(face=>face.arrived).length} / 6 路抵达`;
    element('signal-text').innerHTML=sufficient ? '六面的白光，<br>正在中央相遇。' : '每面先穿过途经点，<br>再由向心镜送往中央。';
  }
  const completed = level.setting === 'school' ? [level.items.filter(i => i.kind === 'waypoint').every(i => (trace.waypointPasses[i.id] ?? []).length), level.items.filter(i => i.kind === 'waypoint').every(i => waypointProgress(level,trace,i.id).complete), sufficient] : trace.cube ? [trace.cube.splits===5,trace.cube.faces.every(face=>face.passed),sufficient] : fusion ? [fusion.yellow.mixed && fusion.cyan.mixed, fusion.yellow.passed && fusion.cyan.passed, sufficient] : rural ? [hayMoved === 3, cowsHome === 2, sufficient] : spectrum ? [trace.prismSplits > 0, spectrum.every(color => color.passed), sufficient] : progress
    ? [progress.directions.length >= 2 && progress.sources.length >= 2, progress.complete, energy >= level.threshold]
    : level.setting === 'forest'
    ? [trace.touched.includes('fixed-forest'), ['mirror', 'mirror-2', 'mirror-3', 'mirror-4', 'mirror-5', 'mirror-6'].every(id => trace.touched.includes(id)), sufficient]
    : level.setting === 'street'
    ? [['mirror', 'mirror-2', 'mirror-3', 'mirror-4'].every(id => trace.touched.includes(id)), trace.touched.includes('fixed-street'), sufficient]
    : level.layers === 2
    ? [trace.touched.includes('lift'), trace.touched.includes('balloon'), sufficient]
    : level.theme === 'night'
    ? [['mirror', 'mirror-2', 'mirror-3'].every(id => trace.touched.includes(id)), trace.touched.includes('fixed-harbor'), sufficient]
    : level.number === 1
    ? [trace.touched.includes('fixed'), trace.touched.includes('mirror'), sufficient]
    : [trace.touched.includes('mirror'), trace.touched.includes('fixed'), sufficient];
  if(level.aquarium&&trace.refraction) {
    const water=trace.refraction;
    completed.splice(0,3,level.aquarium.gateOpen,water.rails.length===4&&water.observations.length===2,sufficient);
    element('signal-badge').textContent=sufficient?'水族灯就绪':level.aquarium.gateOpen?'门已解锁 · 继续接力':'先照亮感应器';
    element('signal-text').innerHTML=level.aquarium.gateOpen?'四段滑轨 → 两枚观测环，<br>继续送达水族灯。':'让出水后的光照进感应器，<br>持续片刻便能解锁门。';
    element('water-progress').textContent=water.exited?'入水 → 出水 ✓':water.entered?'已入水':'等待入水';
    element('gate-progress').textContent=level.aquarium.gateOpen?'已解锁 · 保持开启':water.sensorPower>=.2?'正在感应…':'等待感应';
    element('rail-progress').textContent=`${water.rails.length} / 4`;
    element('observation-progress').textContent=`${water.observations.length} / 2`;
    for(const item of level.items.filter(i=>['gate','sensor','waypoint'].includes(i.kind))) {
      const label=document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);
      if(label)label.textContent=item.kind==='gate'?level.aquarium.gateOpen?'门 · 已解锁':'门 · 待解锁':item.kind==='sensor'?level.aquarium.gateOpen?'感应 ✓':water.sensorPower>=.2?'感应中…':'感应器':`${item.name} ${water.observations.includes(item.id)?'✓':'○'}`;
    }
  }
  element('refraction-status').hidden=!level.aquarium;
  updatePhotoelectricUI(level,trace);
  updateQuantumUI(level,trace);
  if(level.quantum&&trace.quantum){
    const q=trace.quantum;completed.splice(0,3,q.powered,q.recordsValid&&q.records.open,q.recordsValid&&q.records.a&&q.records.b);
    element('signal-badge').textContent=sufficient?'实验完成':q.powered?q.closed?'双路干涉':'开放探测':'先接通电源';
    element('signal-text').textContent=q.message;
  }
  if(level.photoelectric&&trace.photoelectric) {
    const photo=trace.photoelectric;
    completed.splice(0,3,photo.emitting,photo.relayOn,sufficient);
    element('signal-badge').textContent=sufficient?'花灯就绪':photo.relayOn?'右区已通电':photo.emitting?'光电流偏小':'先唤醒感光板';
    element('signal-text').innerHTML=sufficient?'光电回路已接通，<br>花灯屏已铺满。':photo.relayOn?'继续接通右区光路，<br>用凹透镜铺满花灯屏。':'先选合适频率，再聚光增流。<br>红光、绿光加亮也不能出电子。';
  }
  ['step-mirror', 'step-fixed', 'step-focus'].forEach((id, index) => element(id).classList.toggle('complete', completed[index]));
  element('step-count').textContent = `${completed.filter(Boolean).length} / 3`;
  document.body.classList.toggle('beacon-lit', sufficient);
  hud.update(level, energy, sufficient);
}

function recalculate(): void {
  if(level.aquarium&&!level.aquarium.gateOpen)level.aquarium.sensorCharge=0;
  trace = traceLevel(level); gate.elapsed = 0;
  view.sync(level); view.updateBeams(trace);
  if (selectedId) {
    const selected = level.items.find(item => item.id === selectedId);
    if (selected && !selected.inInventory && !view.isVisible(selected)) { if (!selected.movable) selectedId = null; closeMenu(); }
  }
  updateSelection(); updateSignal(); updateInventory();
}

function closeMenu(): void { menu.hidden = true; }
function sendCowHome(id: string): void {
  const result = herdCow(level, id); toast(result.message);
  if (result.ok) { moves++; recalculate(); }
}
function rotate(steps: number): void {
  if (inHome || gesture || !selectedId || settingsDialog.open || storybook.open || home?.guide.open) return;
  const item = level.items.find(item => item.id === selectedId);
  if (item && !view.isVisible(item)) { toast('这里暂时没有光，可以把回收标记拖回物品栏。'); return; }
  if (rotateItem(level, selectedId, steps)) { soundEffects.play('rotate'); moves++; recalculate(); }
}
function openRotationMenu(id: string, position: Point): void {
  selectedId = id; updateSelection();
  const item = level.items.find(candidate => candidate.id === id)!;
  if (item.kind === 'cow' || item.kind === 'hay' || item.kind === 'block' && item.movable) {
    menu.innerHTML = `<div class="rotation-menu-heading"><span>${icon(item.kind === 'hay' ? 'hay' : 'leaf')} ${item.name}</span><small>${item.kind === 'cow' ? '沿村路回圈' : '可搬动'}</small></div><p>${item.kind === 'cow' ? '清出通道，它会自己走回圈里。' : '可拖到空格或物品栏，也可直接搬走。'}</p><button class="recover-button" role="menuitem" ${item.kind === 'cow' ? `data-herd="${item.id}"` : `data-recover="${item.id}"`}>${item.kind === 'cow' ? '赶回牛圈' : item.kind === 'block' ? '收纳挡光块' : '收纳稻草堆'}</button>`;
    menu.hidden = false;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(10, Math.min(position.x + 10, innerWidth - bounds.width - 10))}px`;
    menu.style.top = `${Math.max(10, Math.min(position.y + 10, innerHeight - bounds.height - 10))}px`;
    return;
  }
  if (item.movable && !view.isVisible(item)) {
    menu.innerHTML = `<div class="rotation-menu-heading"><span>${icon('mirror')} ${item.name}</span><small>光照外</small></div><p>这是你留下的器件标记。可拖回物品栏，也可直接收回。</p><button class="recover-button" role="menuitem" data-recover="${item.id}">${icon('box')}收回物品栏</button>`;
    menu.hidden = false;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(10, Math.min(position.x + 10, innerWidth - bounds.width - 10))}px`;
    menu.style.top = `${Math.max(10, Math.min(position.y + 10, innerHeight - bounds.height - 10))}px`;
    return;
  }
  const vertical = item.kind === 'liftMirror' || item.kind === 'balloonMirror' || item.kind === 'prism' || item.kind === 'coreMirror';
  const angles = vertical ? [0, 90, 180, 270] : [0, 45, 90, 135];
  const defaultExplanation = item.kind === 'concaveLens' ? '角度表示光轴方向 · 向外展开光幅，留出到幕布的距离' : item.kind === 'prism' ? '箭头顺着入射白光 · 分成七色扇形光路' : item.kind === 'liftMirror' ? '箭头沿入射光前进方向 · 接光后竖直向上' : item.kind === 'balloonMirror' ? '接住洞口升起的光 · 箭头指向水平出光方向' : item.kind === 'lens' ? '角度表示光轴方向 · 焦距两格' : '角度表示镜面方向';
  const explanation=item.rail ? '只能沿滑轨刻度拖动 · 不可离轨或收纳 · 镜面仍可右键旋转' : item.kind==='coreMirror' ? '只放中央圆座 · 箭头沿来光；一束送入光心，余光接力到下一面' : defaultExplanation;
  menu.innerHTML = `<div class="rotation-menu-heading"><span>${icon(item.rotatable ? item.kind : 'lock')} ${item.name}</span><small>${item.rotatable ? '选择朝向' : '方向固定'}</small></div>${item.rotatable ? `<div class="angle-options">${angles.map(angle => `<button role="menuitemradio" aria-checked="${angle === item.angle}" data-angle="${angle}" class="${angle === item.angle ? 'active' : ''}">${vertical ? `<i class="direction-preview" style="--angle:${angle}deg">→</i>` : `<i class="angle-preview ${item.kind}" style="--angle:${angle}deg"></i>`}<span>${angle}°${vertical ? [' 向右', ' 向下', ' 向左', ' 向上'][angle / 90] : ''}</span></button>`).join('')}</div><div class="quick-turn"><button role="menuitem" data-turn="-1">${icon('reset')}左转 ${vertical ? 90 : 45}°</button><button role="menuitem" data-turn="1">${icon('right')}右转 ${vertical ? 90 : 45}°</button></div><p>${explanation}</p>` : '<p class="fixed-message">这件物品的位置和方向由关卡固定。</p>'}`;
  menu.hidden = false;
  const bounds = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(10, Math.min(position.x + 10, innerWidth - bounds.width - 10))}px`;
  menu.style.top = `${Math.max(10, Math.min(position.y + 10, innerHeight - bounds.height - 10))}px`;
}
menu.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || !selectedId) return;
  if (button.dataset.herd) {
    sendCowHome(button.dataset.herd);
  } else if (button.dataset.recover) {
    if (storeItem(level, button.dataset.recover)) { moves++; selectedId = null; recalculate(); toast('已收回物品栏，朝向会保留。'); }
  } else if (button.dataset.angle !== undefined) {
    const item = level.items.find(candidate => candidate.id === selectedId)!;
    rotate((Number(button.dataset.angle) - item.angle) / (item.kind === 'liftMirror' || item.kind === 'balloonMirror' || item.kind === 'prism' || item.kind === 'coreMirror' ? 90 : 45));
  } else if (button.dataset.turn) rotate(Number(button.dataset.turn));
  closeMenu();
});
document.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled || button.matches('[data-angle], [data-turn]')) return;
  if (performance.now() < suppressDragClickUntil && button.closest('#inventory, #scene')) return;
  soundEffects.play('click');
}, true);
document.addEventListener('pointerdown', event => { if (!menu.contains(event.target as Node)) closeMenu(); });
window.addEventListener('resize', closeMenu);

function finishGesture(): void {
  if (!gesture) return;
  const active = gesture; gesture = null;
  if (active.itemId && active.dragged) suppressDragClickUntil = performance.now() + 400;
  if (active.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
  document.body.classList.remove('dragging-item'); stage.classList.remove('dragging'); inventory.classList.remove('drop-ready');
  dragBadge.hidden = true; view.endPlacement(); recalculate();
}
function cancelGesture(): void { finishGesture(); }
function startGesture(event: PointerEvent, item: Item | undefined, capture: HTMLElement, fromInventory = false): void {
  if (inHome || event.button !== 0 || gesture || settingsDialog.open || storybook.open || home?.guide.open) return;
  if (item && view.layerState().overview) { toast(level.cube ? '先选择要操作的面，再拖放器件。' : '先选择“操作下层”或“操作上层”，再拖放器件。'); return; }
  if (item?.allowedLayers && !item.allowedLayers.includes(view.layerState().active)) { toast(`${item.name}请放在${item.allowedLayers[0] === 0 ? '下' : '上'}层。`); return; }
  closeMenu(); event.preventDefault(); selectedId = item?.id ?? null; updateSelection();
  if (item?.kind === 'cow') { sendCowHome(item.id); return; }
  if (item && !item.movable) { toast('这件物品由关卡固定。'); return; }
  const point = view.boardPoint(event.clientX, event.clientY);
  gesture = { pointerId: event.pointerId, capture, itemId: item?.id ?? null, fromInventory, offset: item && !fromInventory ? { x: point.x - item.x, y: point.y - item.y } : { x: 0, y: 0 }, start: { x: event.clientX, y: event.clientY }, last: { x: event.clientX, y: event.clientY }, dragged: false, valid: false, overInventory: fromInventory, candidate: null };
  capture.setPointerCapture(event.pointerId);
  if (item) hud.setExpanded(false);
}
const canvas = view.renderer.domElement;
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  canvas.focus({ preventScroll: true });
  const id = view.hitItem(event.clientX, event.clientY);
  startGesture(event, level.items.find(item => item.id === id), canvas);
});
inventory.addEventListener('pointerdown', event => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-kind]');
  if (!row || event.button !== 0) return;
  const item = level.items.find(candidate => candidate.kind === row.dataset.kind && candidate.inInventory);
  if (!item) { toast('这一类物品已在棋盘上，或由关卡固定。'); return; }
  startGesture(event, item, row, true);
});
document.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (!gesture.dragged && Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) > 4) {
    gesture.dragged = true;
    if (gesture.itemId) soundEffects.play('grab');
  }
  if (!gesture.dragged) return;
  if (!gesture.itemId) {
    view.rotateViewBy(event.clientX - gesture.last.x); stage.classList.add('dragging');
  } else {
    const pointer = { x: event.clientX, y: event.clientY };
    const underPointer = document.elementFromPoint(event.clientX, event.clientY);
    const overStage = containsPoint(stage, pointer) && !underPointer?.closest('.level-heading, .hud-level-controls, #inventory, .scene-toolbar, #spirit-bubble, .celebration');
    gesture.overInventory = containsPoint(inventory, pointer) || containsPoint(element('return-zone'), pointer);
    const point = view.boardPoint(event.clientX, event.clientY);
    const movingItem=level.items.find(item=>item.id===gesture!.itemId)!;
    gesture.candidate = snapItemPosition(movingItem,{x:point.x-gesture.offset.x,y:point.y-gesture.offset.y,layer:point.layer});
    // A preview cannot reveal a destination and thereby grant itself placement permission.
    gesture.valid = overStage && (level.setting !== 'forest' || forestVisible(level, traceLevel(level), gesture.candidate)) && canPlace(level, gesture.itemId, gesture.candidate);
    const preview = structuredClone(level);
    if (gesture.overInventory && !gesture.fromInventory) storeItem(preview, gesture.itemId);
    else if (gesture.valid) moveItem(preview, gesture.itemId, gesture.candidate);
    trace = traceLevel(preview); view.sync(preview); view.updateBeams(trace, true); updateSignal();
    if (overStage) view.previewPlacement(gesture.itemId, gesture.candidate, gesture.valid);
    else if(movingItem.rail){view.sync(level);view.endPlacement();}
    else { view.hideItem(gesture.itemId); view.endPlacement(); }
    inventory.classList.toggle('drop-ready', gesture.overInventory); document.body.classList.add('dragging-item');
    const item = level.items.find(candidate => candidate.id === gesture!.itemId)!;
    dragBadge.innerHTML = `${icon(item.kind)}${item.name}${gesture.overInventory ? ' · 放回物品栏' : ''}`;
    dragBadge.style.left = `${Math.min(innerWidth - 160, event.clientX + 16)}px`;
    dragBadge.style.top = `${Math.min(innerHeight - 45, event.clientY + 12)}px`;
    dragBadge.hidden = overStage;
  }
  gesture.last = { x: event.clientX, y: event.clientY };
});
document.addEventListener('pointerup', event => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (gesture.itemId && gesture.dragged) {
    if (gesture.overInventory) {
      if(level.items.find(item=>item.id===gesture!.itemId)?.rail)toast('滑轨镜固定在轨道上，只能沿轨移动。');
      else if (!gesture.fromInventory && storeItem(level, gesture.itemId)) { soundEffects.play('place'); moves++; selectedId = null; toast('已放回物品栏，朝向会保留。'); }
    } else if (gesture.valid && gesture.candidate) {
      if (moveItem(level, gesture.itemId, gesture.candidate)) { soundEffects.play('place'); moves++; }
    } else toast(gesture.fromInventory ? '这里放不下，物品仍保留在栏中。' : '这里放不下，已回到原来的位置。');
  }
  finishGesture();
});
document.addEventListener('pointercancel', cancelGesture);
window.addEventListener('blur', () => { cancelGesture(); closeMenu(); });
canvas.addEventListener('contextmenu', event => {
  event.preventDefault();
  if (inHome || gesture || settingsDialog.open || storybook.open || home?.guide.open) return;
  const id = view.hitItem(event.clientX, event.clientY);
  if (id) openRotationMenu(id, { x: event.clientX, y: event.clientY });
  else closeMenu();
});
document.addEventListener('wheel', event => {
  if (settingsDialog.open || storybook.open || home?.guide.open) return;
  if (event.target instanceof Element && event.target.closest('#spirit-bubble')) return;
  if (hud.expanded && event.target instanceof Element && event.target.closest('#inventory .inventory-strip, #inventory-details')) return;
  event.preventDefault();
  if (!inHome && !settingsDialog.open && !home?.guide.open && layerGuide.hidden && !gesture) {
    closeMenu();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    view.zoomBy(Math.exp(-Math.max(-500, Math.min(500, delta)) * 0.001));
  }
}, { passive: false, capture: true });

function updateMusicStatus(): void {
  const state = music.state();
  element('music-status').textContent = !state.enabled ? '音乐已关闭。' : state.volume === 0 ? '音量为 0%，调高即可继续聆听。' : state.error ? '音乐暂时未能播放，再次点击页面即可重试。' : !state.unlocked ? '开始操作后，音乐会轻轻响起。' : `章节音乐 · ${state.title}`;
}
function updateSettings(persist = false): void {
  settings = normalizeSettings(settings);
  element<HTMLInputElement>('pitch').value = String(settings.pitch);
  element('pitch-value').textContent = `${settings.pitch}°`;
  element<HTMLInputElement>('rotation-speed').value = String(Math.round(settings.rotationSpeed * 100));
  element('rotation-speed-value').textContent = `${Math.round(settings.rotationSpeed * 100)}%`;
  element<HTMLInputElement>('music-enabled').checked = settings.musicEnabled;
  element<HTMLInputElement>('sound-effects-enabled').checked = settings.soundEffectsEnabled;
  element<HTMLInputElement>('music-volume').value = String(Math.round(settings.musicVolume * 100));
  element('music-volume-value').textContent = `${Math.round(settings.musicVolume * 100)}%`;
  music.setSettings(settings);
  soundEffects.setEnabled(settings.soundEffectsEnabled);
  updateMusicStatus();
  view.setSettings(settings);
  home?.setSettings(settings);
  if (persist) element('settings-saved').textContent = saveSettings(settings) ? '设置已自动保存，下次打开仍会保留。' : '设置已生效，当前浏览器未允许本地保存。';
}
function openSettings(): void { storybook.close(); cancelGesture(); closeMenu(); settingsDialog.showModal(); }
element('open-settings').addEventListener('click', openSettings);
element('close-settings').addEventListener('click', () => settingsDialog.close());
element('done-settings').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', event => { if (event.target === settingsDialog && !containsPoint(settingsDialog, { x: event.clientX, y: event.clientY })) settingsDialog.close(); });
element('pitch').addEventListener('input', event => { settings.pitch = Number((event.target as HTMLInputElement).value); updateSettings(true); });
element('rotation-speed').addEventListener('input', event => { settings.rotationSpeed = Number((event.target as HTMLInputElement).value) / 100; updateSettings(true); });
element('music-enabled').addEventListener('change', event => { settings.musicEnabled = (event.target as HTMLInputElement).checked; updateSettings(true); });
element('sound-effects-enabled').addEventListener('change', event => { settings.soundEffectsEnabled = (event.target as HTMLInputElement).checked; updateSettings(true); });
element('music-volume').addEventListener('input', event => { settings.musicVolume = Number((event.target as HTMLInputElement).value) / 100; updateSettings(true); });
element('reset-settings').addEventListener('click', () => { settings = { ...defaultSettings }; updateSettings(true); });

function refreshHints(): void {
  const state = view.layerState();
  view.showHints(hintStep === level.hints.length && !element('hint-content').hidden ? level.hintPositions.filter(position => state.overview || (position.layer ?? 0) === state.active) : []);
}
function positionLayerGuide(): void {
  if (layerGuide.hidden) return;
  const target = element(level.cube ? 'cube-controls' : 'layer-controls').getBoundingClientRect();
  const card = element('layer-guide-card');
  const bounds = card.getBoundingClientRect();
  const left = Math.max(16, Math.min(target.left, innerWidth - bounds.width - 16));
  const top = Math.max(16, Math.min(target.bottom + 14, innerHeight - bounds.height - 16));
  card.style.left = `${left}px`; card.style.top = `${top}px`;
}
function dismissLayerGuide(): void {
  if (layerGuide.hidden) return;
  const restoreFocus = layerGuide.contains(document.activeElement);
  layerGuide.hidden = true;
  element('layer-controls').classList.remove('guide-target');
  element('cube-controls').classList.remove('guide-target');
  if(restoreFocus && level.cube) element('cube-overview').focus({preventScroll:true});
  if (restoreFocus && !element('layer-controls').hidden) element('edit-lower').focus({ preventScroll: true });
}
function showLayerGuide(): void {
  if (inHome || !level.cube && level.layers !== 2) return;
  element('layer-guide-title').textContent=level.cube ? '六个面，一点一点接通。' : '挡住了？让另一层暂时透明。';
  element('layer-guide-description').innerHTML=level.cube
    ? '<p><b>选一个面</b><span>点击底、右、后、左、前、顶，其余五面自动隐藏；摆好的器件仍会保留。</span></p><p><b>从底面接力</b><span>初始只有底面有光。用平面镜引路，按底 → 右 → 后 → 顶 → 左 → 前逐面接通。</span></p><p><b>途经 → 中央</b><span>穿过圆环后，在中央圆座摆向心分光镜。箭头顺着来光，一束送入光心，余光接力到下一面。</span></p><p><b>立方全景</b><span>透明观察整个结构；选面后继续操作。“？”可重看引导。六路须同时抵达。</span></p>'
    : '<p><b>操作下层</b><span>上层棋盘和道具变透明，方便摆放下层器件。</span></p><p><b>操作上层</b><span>下层变透明，方便摆放上层器件。</span></p><p><b>双层全景</b><span>看完整结构；选择一层后继续操作。</span></p>';
  cancelGesture(); closeMenu(); selectedId = null; updateSelection();
  layerGuide.hidden = false;
  element(level.cube ? 'cube-controls' : 'layer-controls').classList.add('guide-target');
  positionLayerGuide(); element('dismiss-layer-guide').focus({ preventScroll: true });
}
layerGuide.addEventListener('click', dismissLayerGuide);
element('show-layer-guide').addEventListener('click', () => { if (layerGuide.hidden) showLayerGuide(); else dismissLayerGuide(); });
element('layer-controls').addEventListener('click', event => {
  if (!(event.target as HTMLElement).closest('#show-layer-guide')) dismissLayerGuide();
});
window.addEventListener('resize', positionLayerGuide);
function updateLayerInterface(): void {
  const state = view.layerState();
  element('layer-controls').hidden = !!level.cube || state.count === 1;
  element('cube-controls').hidden=!level.cube;
  if(level.cube) {
    const cube=view.cubeState();
    document.querySelectorAll<HTMLElement>('[data-cube-face]').forEach(button=>{const active=!state.overview && Number(button.dataset.cubeFace)===state.active;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    element('cube-overview').classList.toggle('active',state.overview);element('cube-overview').setAttribute('aria-pressed',String(state.overview));
    element('cube-note').textContent=state.overview ? '全景只观察 · 请选择一个面继续拖放' : `${CUBE_FACES[state.active].name}操作中 · 镜子可收回后换面摆放`;
    element('cube-hide-others').textContent=cube.hideOthers ? '其余五面已隐藏' : '其余五面已透明';
    element('cube-hide-others').setAttribute('aria-pressed',String(cube.hideOthers));
  }
  for (const [id, active] of [['edit-lower', !state.overview && state.active === 0], ['edit-upper', !state.overview && state.active === 1], ['layer-overview', state.overview]] as const) {
    element(id).classList.toggle('active', active);
    element(id).setAttribute('aria-pressed', String(active));
  }
  element('layer-note').textContent = state.overview ? '双层全景 · 请选择一层继续操作' : `${state.active === 0 ? '下层' : '上层'}操作中 · ${state.active === 0 ? '上层' : '下层'}棋盘和器件已淡化`;
  refreshHints();
}
function selectCubeFace(layer:number,overview=false): void {
  if(!level.cube) return;
  dismissLayerGuide();cancelGesture();closeMenu();selectedId=null;
  view.setLayerMode(layer,overview);updateLayerInterface();updateSelection();
}
document.querySelectorAll<HTMLButtonElement>('[data-cube-face],[data-cube-jump]').forEach(button=>button.addEventListener('click',()=>selectCubeFace(Number(button.dataset.cubeFace??button.dataset.cubeJump))));
element('cube-overview').addEventListener('click',()=>selectCubeFace(view.layerState().active,true));
element('cube-hide-others').addEventListener('click',()=>{dismissLayerGuide();if(!level.cube)return;view.setCubeOthers(!view.cubeState().hideOthers);updateLayerInterface();});
element('cube-guide').addEventListener('click',()=>{if(layerGuide.hidden)showLayerGuide();else dismissLayerGuide();});

for (const [id, layer, overview] of [['edit-lower', 0, false], ['edit-upper', 1, false], ['layer-overview', 0, true]] as const) {
  element(id).addEventListener('click', () => {
    dismissLayerGuide();
    cancelGesture(); closeMenu(); selectedId = null;
    view.setLayerMode(layer, overview); updateLayerInterface(); updateSelection();
  });
}
element('hint').addEventListener('click', () => {
  const content = element('hint-content');
  const button = element('hint');
  if (hintStep === level.hints.length && !content.hidden) {
    content.hidden = true;
    button.querySelector('span')!.textContent = '重看提示 · 4/4';
    button.querySelector('b')!.textContent = '＋';
    refreshHints();
    return;
  }
  hintStep = Math.min(hintStep + 1, level.hints.length);
  content.innerHTML = level.hints[hintStep - 1]; content.hidden = false;
  button.querySelector('span')!.textContent = hintStep < level.hints.length ? `再给一点提示 · ${hintStep}/4` : '收起提示 · 4/4';
  button.querySelector('b')!.textContent = hintStep === level.hints.length ? '−' : '＋';
  refreshHints();
});

function updateLevelInterface(): void {
  const night = level.theme === 'night';
  const rural = level.setting === 'rural';
  const street = level.setting === 'street';
  const forest = level.setting === 'forest';
  const stacked = level.layers === 2;
  const crossing = level.items.some(item => item.kind === 'waypoint');
  const experiment = level.theme === 'experiment';
  const chapterName = ['', '第一章', '第二章', '第三章'][level.chapter];
  const next = levelSummaries[levelSummaries.findIndex(entry => entry.number === level.number) + 1];
  document.body.dataset.theme = level.theme;
  document.body.dataset.setting = level.setting ?? '';
  document.body.dataset.stacked = String(stacked);
  document.body.dataset.waypoint = String(crossing);
  document.querySelector('.inventory-instruction')!.textContent = forest ? '镜子放在亮处；暗处标记可拖回收纳。' : '拖到棋盘上，也可以拖回来。';
  document.body.classList.toggle('compact-inventory', stacked || crossing || experiment || rural || !!level.cube);
  document.body.classList.toggle('cube-level',!!level.cube);
  document.title = `暖光小径 · ${chapterName}第${level.chapterLevel}关 · ${level.title}`;
  document.querySelector('.play-area')!.setAttribute('aria-label', `${chapterName}第${level.chapterLevel}关游戏区域`);
  element('chapter-heading').textContent = experiment ? 'CHAPTER 03 · 光的实验' : night ? 'CHAPTER 02 · 黑夜' : 'CHAPTER 01 · 初见光';
  element('level-number').textContent = `第 ${level.chapterLevel} 关`;
  element('level-title').innerHTML = `${level.title} <span>${night ? '☾' : '✦'}</span>`;
  element('level-introduction').textContent = level.introduction;
  element('signal-target').textContent = `${experiment ? '七色同达 · ' : '点亮需要 '}${Math.round(level.threshold * 100)}%`;
  element('step-mirror').textContent = forest ? '① 探进森林' : experiment ? '① 白光分色' : crossing ? '① 双向经过' : street ? '① 绕过障碍' : stacked ? '① 升光' : night ? '① 三面转向' : level.number === 1 ? '① 固定镜' : '① 转向';
  element('step-fixed').textContent = forest ? '② 六镜接力' : experiment ? '② 七色途经' : crossing ? '② 两路抵达' : street ? '② 四镜接力' : stacked ? '② 接光' : night ? '② 接回灯塔' : level.number === 1 ? '② 再反射' : '② 反射';
  element('step-focus').textContent = forest ? '③ 回家' : experiment ? '③ 汇成彩虹' : street ? '③ 开饭' : night ? '③ 引航' : level.number === 1 ? '③ 点亮' : '③ 聚焦';
  element('completion-title').textContent = forest ? '走过长夜，家就在这里。' : experiment ? '七种颜色，一起回到天空。' : street ? '天还没亮，先吃口热的。' : night ? '今夜，有光领航。' : '光，找到归途了。';
  element('completion-text').textContent = forest ? '木屋的窗透出暖光，赶夜路的人循着火光走到家门前。' : experiment ? '七条小径已经连通，云间的彩虹桥为你升起。' : crossing ? '两束光守住了约定，一起抵达了终点。' : street ? '她留着的灯，照亮了他们的早饭。' : stacked ? '光穿过两层小径，送来了云上的回信。' : night ? '灯塔亮起，小船有了前行的方向。' : level.number === 1 ? '学会反射了，下一段试试让光聚拢。' : '带着聚焦的灵感，让光走上另一层。';
  element('next-level').hidden = !next;
  if (next) element('next-level').textContent = `下一关 · ${next.title} →`;
  document.querySelector('.board-label')!.innerHTML = `${forest ? '月下归林' : experiment ? '天空实验花园' : street ? '天亮前的街道' : stacked ? '双层光之庭院' : night ? '星海航路' : '光之庭院'} <i>${stacked ? '2 × ' : ''}${level.size} × ${level.size}</i>`;
  document.querySelector('.receiver-card .eyebrow')!.textContent = forest ? '月光里的小木屋' : experiment ? '汇虹台' : street ? '路边早餐' : night ? '夜航灯塔' : '终点信标';
  document.querySelector('.journey-card h3')!.textContent = forest ? '一点火光，一段归途' : experiment ? '把颜色还给天空' : crossing ? '两束光，一个约定' : street ? '为早起的人留一盏灯' : night ? '为小船留一盏灯' : '让光走一小段路';
  document.querySelector('.night-caption')!.textContent = forest ? '视野有限 · 只看清光束与木屋周围一格。' : street ? '04:50 · 她把阳台的灯留着。' : '星光很远，灯火就在前方。';
  element('world-labels').innerHTML = level.items.filter(item => (!item.movable && item.kind !== 'block') || item.rail).map(item => {
    const band = SPECTRUM.find(color => color.id === item.color);
    const name = level.fusion && !['source','mirror'].includes(item.kind) ? item.name : item.kind === 'mirror' ? `${icon('lock')}固定` : item.kind === 'colorWaypoint' ? `${band?.name} · ○` : item.kind === 'waypoint' ? '途经点 · 0/2' : forest ? item.kind === 'source' ? '篝火' : '小木屋' : item.kind === 'source' ? crossing ? item.name : street ? '阳台吊灯' : night ? '小灯' : '光源' : experiment ? '汇虹台' : street ? '路边早餐' : night ? '灯塔' : '终点';
    return `<span class="world-label ${item.rail ? 'rail-label' : item.kind === 'mirror' ? 'fixed-label' : item.kind === 'colorWaypoint' || item.kind === 'powerWaypoint' ? 'color-label' : item.kind === 'waypoint' ? 'waypoint-label' : ''}" ${band ? `style="--band:${band.color}"` : ''} data-item="${item.id}">${item.rail ? item.id.slice(-1).toUpperCase() + (item.rail.axis === 'y' ? ' ↕' : ' ↔') : name}</span>`;
  }).join('');
  document.body.classList.toggle('fusion-level',!!level.fusion);
  document.body.classList.toggle('refraction-level',!!level.aquarium);
  document.body.classList.toggle('photoelectric-level',!!level.photoelectric);
  document.body.classList.toggle('quantum-level',!!level.quantum);
  if(level.quantum){
    element('signal-target').textContent='开放记录＋两个明暗状态';
    element('step-mirror').textContent='① 选色通电';element('step-fixed').textContent='② 单次探测';element('step-focus').textContent='③ 干涉互换';
    element('completion-title').textContent='每一束光，都有自己的回答。';element('completion-text').textContent='一颗颗探测光点，连成了暖光小径。你完成了这段光的旅程。';
    document.querySelector('.board-label')!.innerHTML='云端单光子实验庭院 <i>19 × 19</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent='探测端 · 每次发射的概率';
    document.querySelector('.journey-card h3')!.textContent='从单次落点，到两路干涉';
    document.querySelector('.inventory-instruction')!.textContent='十六面库存镜、两面滑轨镜；器材可收纳。';
    for(const item of level.items.filter(i=>!i.inInventory&&i.kind!=='block')){const label=document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);if(label)label.textContent=item.rail?item.id.slice(-1).toUpperCase()+' ↔':item.name;}
  }
  if(level.photoelectric) {
    element('signal-target').textContent='铺满花灯 · 达到 54%';
    element('step-mirror').textContent='① 选频聚光';element('step-fixed').textContent='② 光电接通';element('step-focus').textContent='③ 铺亮花灯';
    element('completion-title').textContent='一颗电子，捎来一片灯火。';
    element('completion-text').textContent='感光板触发了电源，光跨过两座实验岛的接力，花灯终于一起亮起。';
    document.querySelector('.board-label')!.innerHTML='双岛光电实验室 <i>17 × 17</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent='右区光幕花灯';
    document.querySelector('.journey-card h3')!.textContent='从光子，到电子，再到灯火';
    document.querySelector('.inventory-instruction')!.textContent='十二镜接力；左区聚光，右区扩光。';
    for(const item of level.items.filter(i=>!i.movable&&i.kind!=='block')) {
      const label=document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);if(label)label.textContent=item.name;
    }
  }
  if(level.aquarium) {
    element('signal-target').textContent='折射接力 · 达到 20%';
    element('step-mirror').textContent='① 折射开门';element('step-fixed').textContent='② 滑轨接力';element('step-focus').textContent='③ 点亮水族';
    element('completion-title').textContent='水的另一侧，也收到了光。';
    element('completion-text').textContent='折射、滑轨与感应门都已接通，水族灯亮起，气泡带着光缓缓升空。';
    document.querySelector('.board-label')!.innerHTML='水边光学实验室 <i>15 × 15</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent='云边水族灯';
    document.querySelector('.journey-card h3')!.textContent='先开门，再接回水边的光';
    document.querySelector('.inventory-instruction')!.textContent='五面普通镜可收纳；A–D 镜只能沿滑轨拖动。';
    for(const item of level.items.filter(i=>!i.movable&&i.kind!=='block')) {
      const label=document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);if(label)label.textContent=item.name;
    }
  }
  if (level.fusion) {
    element('signal-target').textContent = '双增强途经 · 合束抵达';
    element('step-mirror').textContent = '① 两色合成'; element('step-fixed').textContent = '② 同色增强'; element('step-focus').textContent = '③ 合束发射';
    element('completion-title').textContent = '光的力量，来自一起前行。';
    element('completion-text').textContent = '两路增强光通过验证，云端激光发射台启动了。';
    document.querySelector('.receiver-card .eyebrow')!.textContent = '云端激光发射台';
    document.querySelector('.journey-card h3')!.textContent = '先合成，再一起长大';
    const names: Record<string,string> = {'split-green':'分流 ½ ↑→','mix-yellow':'红＋绿 →黄','mix-cyan':'绿＋蓝 →青 ↑','boost-yellow':'黄＋黄 →','boost-cyan':'青＋青 →','final-combiner':'双路合束 →','beacon':'激光台'};
    for (const [id,name] of Object.entries(names)) document.querySelector(`[data-item="${id}"]`)!.textContent = name;
  }
  labels = [...document.querySelectorAll<HTMLElement>('.world-label')];
  if(level.cube) {
    element('step-mirror').textContent='① 分光接力';element('step-fixed').textContent='② 六面途经';element('step-focus').textContent='③ 汇入光心';
    element('completion-title').textContent='六面小径，在光心相遇。';
    element('completion-text').textContent='从底面出发的同一束光，走过六面，一起点亮了中央。';
    document.querySelector('.board-label')!.innerHTML='六面光之庭院 <i>6 × 7 × 7</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent='中央悬浮光心';
    document.querySelector('.journey-card h3')!.textContent='六面，同一个归处';
    document.querySelector('.inventory-instruction')!.textContent='从底面接光；向心分光镜只放中央圆座。';
    for(const item of level.items.filter(item=>!item.movable && item.kind!=='block')) {
      const label=document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);
      if(label) label.textContent=item.kind==='cubeWaypoint' ? `${CUBE_FACES[item.layer!].name}途经 · ○` : item.kind==='beacon' ? '悬浮光心' : item.kind==='source' ? '唯一光源' : '固定镜';
    }
  }
  if (rural) {
    document.querySelector('.inventory-instruction')!.textContent = '拖开稻草，点击牛回圈；凹透镜展开画面。';
    element('step-mirror').textContent = '① 挪稻草'; element('step-fixed').textContent = '② 牛归圈'; element('step-focus').textContent = '③ 放电影';
    element('completion-title').textContent = '电影开场，整个村子都坐下了。';
    element('completion-text').textContent = '稻草挪开了，牛也回圈了。把这一晚的光，留给大人和孩子。';
    document.querySelector('.board-label')!.innerHTML = '村口晒谷场 <i>9 × 9</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent = '露天电影幕布';
    document.querySelector('.journey-card h3')!.textContent = '等一场全村的电影';
    document.querySelector('.night-caption')!.textContent = '拖动稻草堆 · 点击牛赶回圈 · 凹透镜让光展开。';
    document.querySelector('[data-item="source"]')!.textContent = '放映机';
    document.querySelector('[data-item="beacon"]')!.textContent = '电影幕布';
  }
  if (level.setting === 'school') {
    document.querySelector('.inventory-instruction')!.textContent = '先搬书箱，再让光穿过两张课桌和讲台。';
    document.querySelector('[data-kind="block"] .inventory-name strong')!.textContent = '可搬书箱';
    document.querySelector('[data-kind="waypoint"] .inventory-name strong')!.textContent = '桌下与讲台';
    element('waypoint-status').querySelector('span')!.innerHTML = `${icon('waypoint')}课桌与讲台 <b id="waypoint-value">0 / 3</b>`;
    element('step-mirror').textContent = '① 穿过桌椅'; element('step-fixed').textContent = '② 途经抵达'; element('step-focus').textContent = '③ 点亮晚读';
    element('completion-title').textContent = '灯亮了，书页又翻开了。';
    element('completion-text').textContent = '同学们放下担心，重新低头读书、写字。今晚的努力可以继续了。';
    document.querySelector('.board-label')!.innerHTML = '停电的晚自习教室 <i>11 × 11</i>';
    document.querySelector('.receiver-card .eyebrow')!.textContent = '教室应急灯';
    document.querySelector('.journey-card h3')!.textContent = '把晚读的光接回来';
    document.querySelector('.night-caption')!.textContent = '搬开书箱 · 桌下两处与讲台须全部途经 · 末段凸透镜聚焦。';
    element('signal-target').textContent = '三处途经 · 聚焦达到 53%';
    document.querySelector('[data-item="source"]')!.textContent = '走廊备用灯';
    document.querySelector('[data-item="beacon"]')!.textContent = '教室应急灯';
  } else {
    document.querySelector('[data-kind="block"] .inventory-name strong')!.textContent = '挡光块';
    document.querySelector('[data-kind="waypoint"] .inventory-name strong')!.textContent = '双向途经点';
    element('waypoint-status').querySelector('span')!.innerHTML = `${icon('waypoint')}双向途经 <b id="waypoint-value">0 / 2</b>`;
  }
  storybook.setLevel(level, gate.won);
  chapterSpirit.setChapter(level.chapter);
}

function beginLevelOpening(includeChapter: boolean, includeGuide: boolean): void {
  const continueToBoard = () => {
    if (inHome) return;
    if (includeGuide && (level.cube || level.layers === 2)) showLayerGuide();
    else canvas.focus({ preventScroll: true });
  };
  storybook.beginOpening(() => {
    if (includeChapter && level.chapterLevel === 1 && !inHome) chapterSpirit.tellChapter(continueToBoard);
    else continueToBoard();
  });
}
function resetLevel(number: LevelNumber, forceOpening = false): void {
  const entering = forceOpening || number !== level.number;
  hud.setExpanded(false);
  dismissLayerGuide();
  cancelGesture(); closeMenu(); level = createLevel(number); selectedId = null; hintStep = 0; moves = 0; gate.reset();
  music.setChapter(level.chapter);
  clearTimeout(toastTimer); element('toast').classList.remove('visible');
  element('toast').textContent = '';
  element('celebration').hidden = true; element('hint-content').hidden = true;
  element('hint').querySelector('span')!.textContent = '查看本关提示';
  element('hint').querySelector('b')!.textContent = '＋';
  view.showHints([]); view.resetView(); updateLevelInterface(); recalculate(); view.setLayerMode(0,!!level.cube); updateLayerInterface();
  view.resetStory();
  if (!inHome) beginLevelOpening(entering, entering);
}
function switchLevel(number: LevelNumber): void {
  if (!progress.canPlay(number)) return;
  settingsDialog.close();
  hasStarted = true;
  const fromHome = inHome;
  if (inHome) setHomeScreen(false);
  resetLevel(number, fromHome);
  const url = new URL(location.href);
  url.searchParams.set('level', String(number));
  history.pushState(null, '', url);
}
element('next-level').addEventListener('click', () => {
  const next = levelSummaries[levelSummaries.findIndex(entry => entry.number === level.number) + 1];
  if (gate.won && next) switchLevel(next.number);
});
function setHomeScreen(show: boolean): void {
  settingsDialog.close();
  storybook.close();
  chapterSpirit.close();
  if (show) {
    resumeLayerGuide = !layerGuide.hidden;
    cancelGesture(); closeMenu(); dismissLayerGuide();
  }
  inHome = show;
  hud.setHome(show);
  hud.setExpanded(false);
  document.body.classList.toggle('at-home', show);
  for (const selector of ['.game-layout']) document.querySelector<HTMLElement>(selector)!.inert = show;
  if (show) home!.show(hasStarted || progress.data.completed.length > 0);
  else {
    home!.hide();
    updateLevelInterface();
    updateSignal();
    if (resumeLayerGuide) { resumeLayerGuide = false; showLayerGuide(); }
    else canvas.focus({ preventScroll: true });
  }
}
element('return-home').addEventListener('click', () => {
  const url = new URL(location.href); url.searchParams.delete('level');
  history.pushState(null, '', url);
  setHomeScreen(true);
});
window.addEventListener('popstate', () => {
  const showHome = !new URL(location.href).searchParams.has('level');
  const target = levelFromUrl();
  if (!showHome && !progress.canPlay(target)) { returnToLockedHome(); return; }
  setHomeScreen(showHome);
  if (!showHome) { hasStarted = true; resetLevel(target); }
});
function returnToLockedHome(): void {
  const url = new URL(location.href); url.searchParams.delete('level'); history.replaceState(null, '', url);
  setHomeScreen(true);
  hasStarted = false;
  resetLevel(nextPlayable(progress.data));
  home!.show(progress.data.completed.length > 0);
}

element('restart').addEventListener('click', () => {
  settingsDialog.close();
  resetLevel(level.number); toast('物品已收好，开始一条新的小径。');
});
element('continue').addEventListener('click', () => { element('celebration').hidden = true; });
element('zoom-in').addEventListener('click', () => view.zoomBy(1.12));
element('zoom-out').addEventListener('click', () => view.zoomBy(1 / 1.12));
element('reset-view').addEventListener('click', () => view.resetView());
window.addEventListener('keydown', event => {
  if (inHome || storybook.open || home?.guide.open) return;
  if (event.key === 'Escape' && chapterSpirit.speaking) { chapterSpirit.finish(); return; }
  if (!layerGuide.hidden) {
    if (event.key === 'Escape' || event.key === 'Enter') { event.preventDefault(); dismissLayerGuide(); }
    if (event.key === 'Tab') { event.preventDefault(); element('dismiss-layer-guide').focus({ preventScroll: true }); }
    return;
  }
  if (settingsDialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape') { closeMenu(); cancelGesture(); selectedId = null; updateSelection(); return; }
  if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;
  if (event.key.toLowerCase() === 'q') { event.preventDefault(); rotate(-1); closeMenu(); }
  if (event.key.toLowerCase() === 'e') { event.preventDefault(); rotate(1); closeMenu(); }
});
let labels = [...document.querySelectorAll<HTMLElement>('.world-label')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let previousTime = performance.now();
let lastQuantumCountPaint=0;
function frame(now: number): void {
  const delta = Math.max(0, (now - previousTime) / 1000); previousTime = now;
  if(advanceQuantumExperiment(level,trace,delta,!inHome&&!gesture&&!settingsDialog.open&&!storybook.open&&!home?.guide.open&&layerGuide.hidden&&!document.hidden)){recalculate();}
  if(advanceAquariumGate(level,trace,delta,!inHome&&!gesture&&!settingsDialog.open&&!storybook.open&&!home?.guide.open&&layerGuide.hidden&&!document.hidden)) {
    recalculate();toast('感应门已解锁。重新调整 A 镜，把光接向后半段。');
  }
  if (!inHome && !gesture && !settingsDialog.open && !storybook.open && !home?.guide.open && !document.hidden && advanceHerds(level, delta, reduceMotion.matches)) recalculate();
  const alreadyWon = gate.won;
  gate.update(isLightReady(level, trace) && !inHome && !gesture && !settingsDialog.open && !storybook.open && !home?.guide.open && layerGuide.hidden && !document.hidden, delta, level.holdSeconds);
  if (gate.won && !alreadyWon) {
    element('celebration').hidden = false; storybook.setWon(true);
    if (progress.complete(level.number)) {
      journey.refresh();
      if (!progress.saved) toast('本次已通关，浏览器未允许保存进度。');
    }
  }
  element('charge-fill').style.width = `${Math.min(gate.elapsed / level.holdSeconds, 1) * 100}%`;
  element('zoom-value').textContent = `${Math.round(view.viewState().zoom * 100)}%`;
  const bounds = stage.getBoundingClientRect();
  if (!inHome) {
    const activeLayer = view.layerState().active;
    chapterSpirit.position(view.screenPoint({ x: .05, y: level.size * .73, layer: activeLayer }, 1.25), bounds, document.hidden || settingsDialog.open || storybook.open || reduceMotion.matches, hud.insets);
  }
  for (const label of labels) {
    const item = level.items.find(candidate => candidate.id === label.dataset.item)!;
    const point = view.screenPoint(item, level.fusion && item.kind === 'booster' ? 1.9 : item.kind === 'powerWaypoint' ? .8 : item.kind === 'colorWaypoint' ? 0.95 : item.kind === 'beacon' ? level.setting === 'school' ? 1.3 : level.setting === 'street' ? 1.2 : level.theme === 'night' ? 2.4 : 1.55 : item.kind === 'source' && level.setting === 'street' ? 1.9 : 1.3);
    label.style.transform = `translate(${point.x - bounds.left}px, ${point.y - bounds.top}px) translate(-50%, -50%)`;
    const layers = view.layerState();
    if(level.cube && item.kind==='beacon') label.style.marginTop='-24px';else label.style.marginTop='';
    label.style.opacity = String(view.visibilityOpacity(item));
    label.hidden = !!item.inInventory || view.visibilityOpacity(item) <= 0.001 || (!layers.overview && !(level.cube && item.layer===-1) && (item.layer ?? 0) !== layers.active) || point.x < bounds.left + 40 || point.x > bounds.right - 40 || point.y < bounds.top + 55 || point.y > bounds.bottom - 65;
    if(level.cube && layers.overview && !['source','beacon'].includes(item.kind)) label.hidden=true;
  }
  if (inHome) home?.frame(delta, settingsDialog.open || journey.open);
  else view.render(reduceMotion.matches ? 0 : now / 1000, gate.won);
  if(level.quantum&&now-lastQuantumCountPaint>150){const q=view.atmosphereState().quantum;if(q)updateQuantumCounts(q.counts.a,q.counts.b);lastQuantumCountPaint=now;}
  requestAnimationFrame(frame);
}
const journey = new JourneyMenu(progress, {
  onSelect: switchLevel,
  onDebugSelect: switchLevel,
  onReset: () => { returnToLockedHome(); },
  onDebugExit: () => { if (!progress.canPlay(level.number)) returnToLockedHome(); },
});
window.addEventListener('storage', event => {
  if (event.key !== progressStorageKey && event.key !== null) return;
  progress.reload(); journey.refresh();
  // A reset in another tab must also invalidate an unfinished or won old layout.
  returnToLockedHome();
});
home = new StartScreen({ settings, onSettings: openSettings, onLevels: () => journey.show(), onStart: () => {
  const starting = !hasStarted;
  if (!progress.canPlay(level.number)) resetLevel(nextPlayable(progress.data));
  const url = new URL(location.href); url.searchParams.set('level', String(level.number));
  history.pushState(null, '', url);
  hasStarted = true;
  setHomeScreen(false);
  if (starting) beginLevelOpening(true, true);
} });
updateSettings(); updateLevelInterface(); recalculate(); updateLayerInterface();
if (inHome) setHomeScreen(true); else beginLevelOpening(true, true);
if (blockedEntry) journey.show('此关尚未解锁，请先完成前面的关卡。');
requestAnimationFrame(frame);
Object.defineProperty(window, '__warmLight', { value: {
  music: () => music.state(),
  home: () => home!.state(),
  state: () => ({ level: structuredClone(level), received: { ...trace.received }, qualifiedReceived: { ...trace.qualifiedReceived }, waypointPasses: structuredClone(trace.waypointPasses), colorPasses: structuredClone(trace.colorPasses), spectrum: spectrumProgress(level, trace), refraction: trace.refraction ? structuredClone(trace.refraction) : null, quantum:trace.quantum?structuredClone(trace.quantum):null, photoelectric: trace.photoelectric ? structuredClone(trace.photoelectric) : null, fusion: trace.fusion ? structuredClone(trace.fusion) : null, prismSplits: trace.prismSplits, ready: isLightReady(level, trace), touched: [...trace.touched], won: gate.won, hold: gate.elapsed, moves, hintStep, selectedId, view: view.viewState(), atmosphere: view.atmosphereState(), layers: view.layerState(), beamPaths: structuredClone(trace.segments), blocked: [...trace.blocked], segments: trace.segments.length, dragging: !!gesture }),
  cubeState: () => ({ ...view.cubeState(), progress:trace.cube ? structuredClone(trace.cube) : null }),
  screenPoint: (position: Point, height = 0.2) => view.screenPoint(position, height),
  itemPoint: (id: string) => { const item = level.items.find(candidate => candidate.id === id)!; return view.screenPoint(item, 0.62); },
} });
