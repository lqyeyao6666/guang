import './start-screen.css';
import { createLevel, levelSummaries } from './level.ts';
import { traceLevel } from './optics.ts';
import { GameScene } from './scene.ts';
import type { Settings } from './settings.ts';

const chapters = [
  { chapter: 1, theme: 'garden', name: '初见光', description: '先学会听懂光，再陪它走远一点。', color: '#fbf3e6' },
  { chapter: 2, theme: 'night', name: '黑夜', description: '每一盏灯亮起的地方，都有人在等。', color: '#112b44' },
  { chapter: 3, theme: 'experiment', name: '实验', description: '走近一点，光还有许多故事想告诉你。', color: '#dbeef8' },
] as const;

// Display layouts belong to the title screen and are never submitted to the game.
const displayLayouts: Record<number, Record<string, { x: number; y: number; angle: number }>> = {
  1: { mirror: { x: 5, y: 2, angle: 45 } },
  2: { mirror: { x: 2, y: 7, angle: 45 }, 'mirror-2': { x: 6, y: 7, angle: 135 }, 'mirror-3': { x: 6, y: 3, angle: 45 } },
  3: {
    prism: { x: 3, y: 7, angle: 0 },
    mirror: { x: 7, y: 1, angle: 0 }, 'mirror-2': { x: 5, y: 5, angle: 0 }, 'mirror-3': { x: 7, y: 7, angle: 0 },
    'mirror-4': { x: 7, y: 5, angle: 0 }, 'mirror-5': { x: 7, y: 9, angle: 0 }, 'mirror-6': { x: 7, y: 11, angle: 0 },
    'mirror-7': { x: 7, y: 13, angle: 0 }, 'mirror-8': { x: 4, y: 1, angle: 135 }, 'mirror-9': { x: 12, y: 7, angle: 135 },
  },
};

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const gear = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m10 3-1 3-3 1-3 1 1 4-1 4 3 1 3 1 1 3h4l1-3 3-1 3-1-1-4 1-4-3-1-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg>';
const keyboard = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M7 16h10"/></svg>';
const cloud = (index: number) => `<svg viewBox="0 0 200 100" fill="none" aria-hidden="true"><defs><linearGradient id="home-cloud-${index}" x1="95" y1="25" x2="102" y2="94" gradientUnits="userSpaceOnUse"><stop class="cloud-lit"/><stop class="cloud-shade" offset="1"/></linearGradient></defs><path d="M38 85C17 85 9 75 12 63c2-11 14-17 26-16C36 28 51 18 66 22c7-21 39-24 52-5 21-4 39 12 37 31 16-5 32 4 33 16 2 14-9 22-27 22Z" fill="url(#home-cloud-${index})"/><ellipse cx="69" cy="45" rx="27" ry="24" fill="url(#home-cloud-${index})"/><ellipse cx="102" cy="36" rx="29" ry="27" fill="url(#home-cloud-${index})"/><ellipse cx="134" cy="52" rx="22" ry="23" fill="url(#home-cloud-${index})"/></svg>`;

/** A separate display scene: the slideshow never edits the active puzzle or its win state. */
export class StartScreen {
  readonly root = document.createElement('section');
  readonly guide = document.createElement('dialog');
  private readonly world = document.createElement('div');
  private readonly snapshot = document.createElement('canvas');
  private view: GameScene | null = null;
  private chapterIndex = 0;
  private elapsed = 0;
  private transition = 2;
  private sceneryTime = 10;
  private settings: Settings;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(options: { settings: Settings; onStart: () => void; onSettings: () => void; onLevels: () => void }) {
    this.settings = { ...options.settings };
    this.root.className = 'home-screen';
    this.root.id = 'start-screen';
    this.root.hidden = true;
    this.root.setAttribute('aria-labelledby', 'home-title');
    this.root.dataset.chapter = '1';
    this.root.innerHTML = `
      <div class="home-halo" aria-hidden="true"></div>
      <div class="home-clouds" aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<span class="home-cloud home-cloud-${index + 1}">${cloud(index)}</span>`).join('')}</div>
      <div class="home-fireflies" aria-hidden="true">${Array.from({ length: 9 }, (_, index) => `<i style="--mote-x:${37 + (index * 17) % 58}%;--mote-y:${12 + (index * 23) % 67}%;--mote-scale:${0.6 + index % 3 * 0.3}"></i>`).join('')}</div>
      <span class="home-moon" aria-hidden="true"></span>
      <div class="home-stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <header class="home-top"><span class="home-wordmark"><span>✳</span> 一场关于光的小小旅行</span><span class="home-top-note">慢慢来，光会找到方向。</span></header>
      <div class="home-copy"><p class="home-eyebrow">A LITTLE PATH OF LIGHT</p><h1 id="home-title">暖光<span>小径</span><i>✦</i></h1><p class="home-intro">做一回小小拾光人，<br>把光送到有人等它的地方。</p>
        <div class="home-actions"><button id="start-game" class="home-start" type="button"><span>开始旅程</span>${arrow}</button><div class="home-secondary"><button id="home-levels" type="button">${keyboard}关卡选择</button><button id="home-settings" type="button">${gear}设置</button><button id="home-controls" type="button">${keyboard}键位引导</button></div></div>
        <p class="home-invitation"><span></span> 没有倒计时，只有一点点发现。</p>
      </div>
      <div class="home-scene-caption" aria-hidden="true"><span id="home-scene-number">01 / 03</span><span id="home-scene-name">初见光</span><i></i><small>让光，走一小段路。</small></div>
      <footer class="home-bottom"><div><p class="home-chapter-label">沿着光，经过三个篇章</p><nav class="home-chapters" aria-label="开始界面背景">${chapters.map((entry, index) => `<button type="button" data-home-chapter="${index}" aria-label="展示第${entry.chapter}章${entry.name}背景" aria-pressed="${index === 0}"><small>0${entry.chapter}</small><span>${entry.name}</span><i></i></button>`).join('')}</nav><p id="home-chapter-description">${chapters[0].description}</p></div><button id="home-motion" type="button" aria-label="暂停背景轮播" aria-pressed="false">Ⅱ <span>暂停轮播</span></button></footer>`;
    this.world.className = 'home-world';
    this.world.setAttribute('aria-hidden', 'true');
    this.root.prepend(this.world);
    this.snapshot.className = 'home-snapshot';
    this.snapshot.setAttribute('aria-hidden', 'true');
    this.guide.id = 'controls-dialog';
    this.guide.setAttribute('aria-labelledby', 'controls-title');
    this.guide.innerHTML = `<div class="settings-heading"><div><div class="eyebrow">A SMALL GUIDE</div><h2 id="controls-title">把光交给你</h2></div><button id="close-controls" class="close-button" type="button" aria-label="关闭键位引导">×</button></div><p class="controls-intro">从物品栏取出镜子，试着把光送到信标。</p><div class="controls-list">
      <div><span class="control-key">左键拖动</span><p><b>摆放与收纳</b><span>把器件拖到棋盘格；拖回底部物品栏即可收好；小箭头可展开说明。</span></p></div>
      <div><span class="control-key">鼠标右键</span><p><b>调整器件朝向</b><span>右键点击棋盘上的器件，在浮动菜单中选择角度。</span></p></div>
      <div><span class="control-key"><kbd>Q</kbd> / <kbd>E</kbd></span><p><b>快捷旋转</b><span>选中器件后，向左 / 向右旋转。固定器件不能调整。</span></p></div>
      <div><span class="control-key">拖动空白</span><p><b>环绕棋盘</b><span>左右拖动棋盘空白处，绕中心旋转视角。</span></p></div>
      <div><span class="control-key">鼠标滚轮</span><p><b>拉近或拉远</b><span>游戏页面内滚动即可缩放；设置打开时暂停缩放。</span></p></div>
      <div><span class="control-key"><kbd>Esc</kbd></span><p><b>取消与关闭</b><span>取消拖拽、关闭角度菜单，或收起设置与引导。</span></p></div>
    </div><p class="controls-tip">卡住时，在设置里查看关卡提示。提示会一步步展开。</p><button id="done-controls" class="primary-button" type="button">明白了</button>`;
    document.body.append(this.root, this.guide);
    this.root.querySelector('#start-game')!.addEventListener('click', options.onStart);
    this.root.querySelector('#home-levels')!.addEventListener('click', options.onLevels);
    this.root.querySelector('#home-settings')!.addEventListener('click', options.onSettings);
    this.root.querySelector('#home-controls')!.addEventListener('click', () => this.guide.showModal());
    for (const id of ['close-controls', 'done-controls']) this.guide.querySelector(`#${id}`)!.addEventListener('click', () => this.guide.close());
    this.guide.addEventListener('click', event => {
      const rect = this.guide.getBoundingClientRect();
      if (event.target === this.guide && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) this.guide.close();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-home-chapter]').forEach(button => button.addEventListener('click', () => this.selectChapter(Number(button.dataset.homeChapter))));
    this.root.querySelector('#home-motion')!.addEventListener('click', () => this.setPaused(!this.paused));
    this.motion.addEventListener('change', () => this.setPaused(this.motion.matches));
    this.setPaused(this.motion.matches);
  }

  private paused = false;
  private setPaused(paused: boolean): void {
    this.paused = paused || this.motion.matches;
    const button = this.root.querySelector<HTMLButtonElement>('#home-motion')!;
    button.disabled = this.motion.matches;
    button.setAttribute('aria-pressed', String(this.paused));
    button.setAttribute('aria-label', this.motion.matches ? '已按系统偏好减少动态效果，可手动切换背景' : this.paused ? '播放背景轮播' : '暂停背景轮播');
    button.innerHTML = `${this.paused ? '▷' : 'Ⅱ'} <span>${this.motion.matches ? '静态背景' : this.paused ? '播放轮播' : '暂停轮播'}</span>`;
  }

  private previewLevel(index: number) {
    const chapter = chapters[index].chapter;
    const entry = levelSummaries.find(level => level.chapter === chapter);
    const level = createLevel(entry?.number ?? 2);
    // Stage existing objects only in the independent title scene.
    for (const item of level.items) {
      if (!item.movable) continue;
      const position = displayLayouts[chapter][item.id];
      if (position) { Object.assign(item, position); item.inInventory = false; }
    }
    return level;
  }

  show(continuing: boolean): void {
    this.root.hidden = false;
    if (!this.view) {
      this.view = new GameScene(this.world, this.previewLevel(this.chapterIndex));
      this.view.renderer.domElement.tabIndex = -1;
      this.view.renderer.domElement.removeAttribute('aria-label');
    } else this.world.prepend(this.view.renderer.domElement);
    this.world.append(this.snapshot);
    this.view.setSettings(this.settings);
    this.selectChapter(this.chapterIndex, false);
    this.root.querySelector('#start-game span')!.textContent = continuing ? '继续旅程' : '开始旅程';
    document.title = '暖光小径 · 让光走一小段路';
    this.root.querySelector<HTMLButtonElement>('#start-game')!.focus({ preventScroll: true });
  }

  hide(): void {
    this.guide.close();
    this.root.hidden = true;
    this.view?.renderer.domElement.remove();
    this.snapshot.remove();
  }

  setSettings(settings: Settings): void {
    this.settings = { ...settings };
    if (!this.root.hidden) this.view?.setSettings(settings);
  }

  private selectChapter(index: number, animate = true): void {
    if (!this.view || this.root.hidden) return;
    if (animate && this.motion.matches) animate = false;
    const renderer = this.view.renderer;
    if (animate) {
      this.view.render(this.motion.matches ? 0 : this.sceneryTime, true);
      this.snapshot.width = renderer.domElement.width;
      this.snapshot.height = renderer.domElement.height;
      const context = this.snapshot.getContext('2d');
      context?.clearRect(0, 0, this.snapshot.width, this.snapshot.height);
      context?.drawImage(renderer.domElement, 0, 0);
      this.snapshot.style.background = chapters[this.chapterIndex].color;
    }
    this.chapterIndex = index;
    this.elapsed = 0;
    this.transition = animate ? 0 : 2;
    this.snapshot.style.opacity = animate ? '1' : '0';
    const chapter = chapters[index];
    this.root.dataset.chapter = String(chapter.chapter);
    this.root.querySelector('#home-scene-number')!.textContent = `0${chapter.chapter} / 03`;
    this.root.querySelector('#home-scene-name')!.textContent = chapter.name;
    this.root.querySelector('#home-chapter-description')!.textContent = chapter.description;
    this.root.querySelectorAll<HTMLButtonElement>('[data-home-chapter]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    const level = this.previewLevel(index);
    this.view.sync(level);
    this.view.resetView();
    this.view.rotateViewBy(-12);
    this.view.updateBeams(traceLevel(level));
    // Start decorative victory scenery fully formed, including the rainbow bridge.
    this.view.render(0, true);
    this.view.render(this.motion.matches ? 0 : this.sceneryTime, true);
  }

  frame(delta: number, blocked: boolean): void {
    if (this.root.hidden || !this.view || document.hidden) return;
    // Modals and reduced motion freeze the backdrop as well as its chapter clock.
    const moving = !blocked && !this.guide.open && !this.paused && !this.motion.matches;
    if (moving) {
      this.elapsed += Math.min(delta, 0.1);
      this.sceneryTime += Math.min(delta, 0.1);
      this.view.rotateViewBy(Math.min(delta, 0.1) * 0.8);
      if (this.elapsed >= 4.5) this.selectChapter((this.chapterIndex + 1) % chapters.length);
    }
    if (!blocked && !this.guide.open) this.transition = Math.min(2, this.transition + Math.min(delta, 0.1));
    this.snapshot.style.opacity = String(1 - this.transition / 2);
    this.root.style.setProperty('--chapter-progress', `${this.elapsed / 4.5 * 100}%`);
    this.root.style.setProperty('--cloud-x', `${this.motion.matches ? 0 : Math.sin(this.sceneryTime * 0.11) * 20}px`);
    this.root.style.setProperty('--cloud-y', `${this.motion.matches ? 0 : Math.sin(this.sceneryTime * 0.19) * 6}px`);
    this.root.style.setProperty('--mote-opacity', String(this.motion.matches ? 0.4 : 0.45 + Math.sin(this.sceneryTime * 0.7) * 0.2));
    this.view.render(this.motion.matches ? 0 : this.sceneryTime, true);
  }

  state() { return { visible: !this.root.hidden, chapter: chapters[this.chapterIndex].chapter, elapsed: this.elapsed, paused: this.paused, transitioning: this.transition < 2, preview: this.view?.atmosphereState() ?? null }; }
}
