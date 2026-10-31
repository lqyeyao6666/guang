import './chapter-spirit.css';
import type { Level } from './level.ts';

export const chapterStories = {
  1: {
    name: '初见光', subtitle: '先陪一束光，走过第一个拐角。',
    paragraphs: ['你好，小小拾光人。我是陪你同行的光精灵。这座庭院里，有一束刚刚出门的光，也有一盏还没醒来的小灯。我们先替它们牵一条路，好吗？', '从一面镜子的转弯开始，你会慢慢学会聚拢光、把光送上云端，也会看见不同来路在同一处相逢。不必着急，每一次试着调整，都是在认识光。'],
    tips: ['从右侧物品栏拖出器件；拖回物品栏就能收好。', '右键点击棋盘上的器件选角度，选中后也可按 Q / E 转向。', '先沿着光观察，再试着调整；卡住时点「给我一点灵感」。'],
    promise: '把这第一声问候，轻轻送过去。',
  },
  2: {
    name: '黑夜', subtitle: '每一盏灯亮起的地方，都有人在等。',
    paragraphs: ['天暗下来了，小小拾光人。你看，海上的船还没靠岸，扫街的人已经出门，林间还有一个背着行囊的身影。我们带着这束光，去陪他们走一段吧。', '光会成为船的方向、路边热饭的一小块天亮，也会让村口的故事开场，让教室里的笔尖继续前行。把灯送到那里，你就会知道是谁在等它。'],
    tips: ['先找光源和收光处，留意场景里真正挡光的物品。', '森林只看得清来光附近的一小段，顺着亮处慢慢往前接。', '有时需要聚拢光，有时需要铺开光；观察本关的接收要求。'],
    promise: '我们点亮的，是某个人正在等待的夜晚。',
  },
  3: {
    name: '光的实验', subtitle: '走近一点，光还有许多故事想告诉你。',
    paragraphs: ['欢迎来到云上的实验庭院，小小拾光人。白光的行囊里藏着颜色，水面会悄悄挪动光的来路，合适的光还能叩响电子的小门。今天，我们带着好奇心出发。', '试着让颜色相遇，追一追水面两侧的光，再看看许多次单次探测留下的回答。每次观察，都可能带来一个新的问题。我会陪你把问题慢慢照亮。'],
    tips: ['留意途经点的颜色与接收条件，照到并不总等于完成。', '水面、透镜和合束器各有作用；先读本关说明，再观察光路。', '实验需要正式放下器件才会推进；提示会逐级展开。'],
    promise: '把好奇心留着，下一束光还会带来回答。',
  },
} as const;

/** A projected companion beside the board. Motion shares the game's existing frame. */
export class ChapterSpirit {
  readonly root = document.createElement('aside');
  private chapter: Level['chapter'] = 1;
  private page = 0;
  private onFinished: (() => void) | null = null;
  private bubbleWidth = 0;
  private bubbleHeight = 0;
  private readonly compact = matchMedia('(max-width:850px)');
  private lastPosition = '';

  constructor(stage: HTMLElement) {
    this.root.className = 'chapter-spirit';
    this.root.innerHTML = `<button id="light-spirit" class="spirit-orb" type="button" aria-label="重听本章故事与提示" aria-controls="spirit-bubble" aria-expanded="false"><span class="spirit-flight" aria-hidden="true"><i class="spirit-wake spirit-wake-one"></i><i class="spirit-wake spirit-wake-two"></i><i class="spirit-mote spirit-mote-one"></i><i class="spirit-mote spirit-mote-two"></i><span class="spirit-core"></span></span></button>
      <section id="spirit-bubble" class="spirit-bubble" aria-label="本章故事与提示" hidden>
        <header><span id="spirit-chapter"></span><button id="close-spirit" type="button" aria-label="收起本章讲述">×</button></header>
        <div id="spirit-reading" tabindex="0"><p id="spirit-subtitle"></p><div id="spirit-story"></div><ol id="spirit-tips" hidden></ol></div>
        <footer><small id="spirit-page"></small><button id="next-spirit" type="button">再听一点 →</button></footer>
      </section>`;
    stage.append(this.root);
    this.find('light-spirit').addEventListener('click', () => {
      if (this.speaking) this.finish();
      else this.tellChapter();
    });
    this.find('close-spirit').addEventListener('click', () => this.finish());
    this.find('next-spirit').addEventListener('click', () => {
      if (this.page === 2) this.finish();
      else { this.page++; this.paint(); }
    });
    // Wheel scrolls this small speech bubble, without changing board zoom.
    this.find('spirit-bubble').addEventListener('wheel', event => event.stopPropagation(), { passive: true });
    this.root.addEventListener('contextmenu', event => event.preventDefault());
    new ResizeObserver(entries => {
      const bounds = entries[0].borderBoxSize[0];
      this.bubbleWidth = bounds.inlineSize;
      this.bubbleHeight = bounds.blockSize;
    }).observe(this.find('spirit-bubble'));
  }

  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector<T>(`#${id}`)!; }
  get speaking(): boolean { return !this.find('spirit-bubble').hidden; }

  position(point: { x: number; y: number }, stage: DOMRect, paused: boolean, insets = { top: 40, bottom: 56 }): void {
    const stopped = String(paused);
    if (this.root.dataset.paused !== stopped) this.root.dataset.paused = stopped;
    // A collapsed viewport cannot fit either the board or its companion.
    this.root.hidden = stage.height < 140;
    if (this.root.hidden) return;
    const size = this.compact.matches ? 48 : 64;
    const margin = 12;
    let x = Math.max(margin, Math.min(stage.width - size - margin, point.x - stage.left - size / 2));
    // On narrow boards, leave a separate edge slot for the light and its speech.
    if (stage.width < 500) x = x < stage.width / 2 ? margin : stage.width - size - margin;
    const y = Math.max(insets.top, Math.min(stage.height - size - insets.bottom, point.y - stage.top - size / 2));
    const transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    if (transform !== this.lastPosition) { this.root.style.transform = transform; this.lastPosition = transform; }
    if (!this.speaking) return;
    const bubble = this.find('spirit-bubble');
    const width = Math.min(300, stage.width - size - margin * 2 - 10);
    const widthText = `${width}px`;
    if (bubble.style.width !== widthText) bubble.style.width = widthText;
    const actualWidth = this.bubbleWidth || width;
    const height = this.bubbleHeight || 200;
    const preferRight = x + size + 10 + actualWidth <= stage.width - margin;
    const left = preferRight ? x + size + 10 : Math.max(margin, x - actualWidth - 10);
    const top = Math.max(insets.top, Math.min(stage.height - height - insets.bottom, y + size / 2 - height * .72));
    bubble.style.left = `${(left - x).toFixed(1)}px`;
    bubble.style.top = `${(top - y).toFixed(1)}px`;
    bubble.style.setProperty('--spirit-arrow-top', `${Math.max(20, Math.min(height - 22, y + size * .42 - top)).toFixed(1)}px`);
    this.root.dataset.bubbleSide = preferRight ? 'right' : 'left';
  }

  setChapter(chapter: Level['chapter']): void {
    if (chapter !== this.chapter) this.close();
    this.chapter = chapter;
    this.root.dataset.chapter = String(chapter);
  }

  tellChapter(onFinished?: () => void): void {
    this.page = 0;
    this.onFinished = onFinished ?? null;
    this.find('spirit-bubble').hidden = false;
    this.find('light-spirit').setAttribute('aria-expanded', 'true');
    this.paint();
  }

  close(): void {
    this.onFinished = null;
    this.find('spirit-bubble').hidden = true;
    this.find('light-spirit').setAttribute('aria-expanded', 'false');
  }

  finish(): void {
    const next = this.onFinished;
    const hadFocus = this.find('spirit-bubble').contains(document.activeElement);
    this.close();
    if (hadFocus) this.find('light-spirit').focus({ preventScroll: true });
    next?.();
  }

  private paint(): void {
    const chapter = chapterStories[this.chapter];
    const tips = this.page === 2;
    this.find('spirit-chapter').textContent = `第${['', '一', '二', '三'][this.chapter]}章 · ${chapter.name}`;
    this.find('spirit-subtitle').textContent = tips ? '带上这三点小提醒' : chapter.subtitle;
    this.find('spirit-story').textContent = tips ? chapter.promise : chapter.paragraphs[this.page];
    this.find('spirit-tips').hidden = !tips;
    if (tips) this.find('spirit-tips').replaceChildren(...chapter.tips.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    this.find('spirit-page').textContent = `${this.page + 1} / 3`;
    this.find('next-spirit').textContent = tips ? '出发吧 →' : this.page === 0 ? '再听一点 →' : '带上小提醒 →';
    this.find('spirit-reading').scrollTop = 0;
  }
}

