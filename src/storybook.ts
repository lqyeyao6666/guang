import './storybook.css';
import type { Level, LevelNumber } from './level.ts';

interface LightStory {
  whisper: string;
  letter: string;
  title: string;
  reply: string;
}

/** A little story for each place; these words never participate in the puzzle rules. */
export const lightStories: Record<LevelNumber, LightStory> = {
  1: {
    whisper: '小光停在拐角，等你替它指一条路。',
    letter: '庭院里，一束第一次出门的光停在了拐角。远处的小灯还睡着，风便请你做一回拾光人：转一下面前的镜子，把这声轻轻的问候送过去。',
    title: '一面镜子，一条新的路。',
    reply: '光拐了一个弯，\n庭院便多了一条路。',
  },
  2: {
    whisper: '一封宽宽的问候，正等着落进小小的灯心。',
    letter: '光已经找到了小灯，却只在它身边铺开一层薄薄的亮。拾光人拿来一枚透镜，让问候在恰好的距离聚拢。原来，抵达以后，还可以再认真一点。',
    title: '小小灯心，接住了光。',
    reply: '把散开的明亮轻轻聚拢，\n小灯就有了自己的晴天。',
  },
  4: {
    whisper: '云上挂着一封信，等楼下的光来读。',
    letter: '风把一封回信送到了云上，楼下的小灯却不会爬楼梯。请替它找一条穿过洞口的路，让红气球接住来光，再把信上的字照清楚。云和庭院之间，也能有一条小径。',
    title: '云上，有人收到了回信。',
    reply: '气球托住了光，\n云把回信轻轻放进灯里。',
  },
  6: {
    whisper: '两盏小灯，各带着半份约定出发。',
    letter: '两盏小灯各收着半份光，约好从不同方向穿过同一个圆环，再一起去见远处的信标。请照顾好两条来路，让它们同时抵达。等待彼此，也是一种照亮。',
    title: '两份光，守住同一个约定。',
    reply: '你走过你的路，我走过我的路，\n最后，在同一盏灯里相逢。',
  },
  11: {
    whisper: '一盏底灯，想替小方盒点亮一颗心。',
    letter: '最初，只有底面的一盏灯。它绕过棱角，在每一面留下一份来信，再把余光送往下一面。拾光人，请让六面的信同时抵达中央。空心的小方盒，也会有一颗明亮的心。',
    title: '六面来信，在心里相逢。',
    reply: '走过不同的面，转过不同的角，\n最初的光在中央认出了自己。',
  },
  3: {
    whisper: '海很宽，船只需要远处一盏认得的灯。',
    letter: '夜里的海，把岸和天空藏成了同一种蓝。小船还在水上，灯塔却没有醒来。请借几面镜子，把岸边的小灯送过去，让远行的人看见方向。',
    title: '今夜，有光领航。',
    reply: '灯塔亮起的时候，\n海上的远方有了方向。',
  },
  5: {
    whisper: '她把阳台的灯留着，等早起的人歇一歇。',
    letter: '天还没亮，扫帚已经走过了长长的街道。阳台上的她留着一盏灯，想照见路沿边的一口热饭。拾光人，请把这份心意送到两位早起的人身旁。',
    title: '天未亮，早饭已经暖了。',
    reply: '扫帚靠在一旁，热气慢慢升起。\n这一小块天亮，来得早了一点。',
  },
  8: {
    whisper: '路一次只亮一小段，家却一直在那里。',
    letter: '林子把路藏得很深，只肯让篝火照清脚前的一小段。背包里的东西很沉，木屋还在远处。请慢慢转动镜子，留心刚走过的路，让赶夜路的人把最后几步走完。',
    title: '走过长夜，家就在这里。',
    reply: '火光停在门前，窗里亮起另一束光。\n这一次，夜路终于走到了家。',
  },
  9: {
    whisper: '稻草挪开以后，村里的夜就有地方放故事了。',
    letter: '幕布挂好了，孩子们还在树边玩，牛却留在村路上。今晚的故事要等大家坐稳才开场。先收拾路上的稻草，送牛回圈，再把光铺满幕布，让整个村口一起看见。',
    title: '村里的夜，有了故事。',
    reply: '牛归了圈，故事上了幕。\n小小的村口，坐满了一个晚上。',
  },
  12: {
    whisper: '停电把一句话，留在了还没翻完的书页里。',
    letter: '灯忽然灭了，笔尖停在半行字上。教室里有人望着窗外，也有人还想读完这一页。拾光人，请把光从桌下和讲台接过去，让应急灯替大家把今晚的故事续上。',
    title: '翻页声，又在灯下响起。',
    reply: '灯亮以后，\n翻页声替夜晚续上了下一句。',
  },
  7: {
    whisper: '白光打开行囊，里面住着七种颜色。',
    letter: '白光来到花园，打开行囊，七种颜色各自跑向喜欢的地方。请让它们穿过自己的圆环，再去云边相见。每一种颜色，都有一段属于自己的风景。',
    title: '七种颜色，架起一座桥。',
    reply: '各自走过一片花园，\n相逢时，把天空连成了桥。',
  },
  10: {
    whisper: '不同的来路，也可以接成同一束明亮。',
    letter: '这次，花园等着两种新颜色：让红与绿相遇，让绿与蓝相遇，再为它们接上同色的伙伴。拾光人，请把各路来光仔细送到中央，让它们一起照向更远的地方。',
    title: '不同的来路，同一束明亮。',
    reply: '每束光带着自己的来处，\n一起，把问候送得更远。',
  },
  13: {
    whisper: '水面把来信折了一个角，收信处也挪了一点。',
    letter: '一封用光写的信穿过鱼缸，仍沿原来的方向前行，却从另一处走出。先接住这点偏移，借它打开门，再沿滑轨接好回程。水里的小鱼，还在等今晚的灯。',
    title: '水边的回信，终于抵达。',
    reply: '水面轻轻折过来信，\n小鱼在亮起的水里，游过最后一行。',
  },
  14: {
    whisper: '两座岛之间，电线也能替光捎去问候。',
    letter: '两座实验岛隔着空隙，来光要先在这边给出信号。找到能唤醒电子的颜色，让继电器接通远处的电源，再把另一座岛的花灯铺亮。问候有时也会换一位信使。',
    title: '一声电的回信，一片灯火。',
    reply: '光轻轻叩门，电送去回音。\n另一座岛上，花灯一盏盏亮了。',
  },
  15: {
    whisper: '一次只留一点光，许多次才读得出回答。',
    letter: '实验庭院里，一次探测只留下一点光。许多次以后，才慢慢显出线索。让同一束光的两条可能来路重新相遇，看看明与暗怎样交换位置。拾光人，请再耐心观察一会儿。',
    title: '光留下回答，好奇仍在路上。',
    reply: '一颗颗光点，写下新的回答。\n好奇心，又照亮了一段路。',
  },
};

const chapterLetters = {
  1: '先学会听懂光，再陪它走远一点。',
  2: '每一盏灯亮起的地方，都有人在等。',
  3: '走近一点，光还有许多故事想告诉你。',
};

/** One reusable reader for level openings and later rereading. */
export class Storybook {
  readonly dialog = document.createElement('dialog');
  private readonly trigger = document.createElement('button');
  private readonly whisper = document.createElement('p');
  private beforeOpen: () => void;
  private openingFinished: (() => void) | null = null;

  constructor(beforeOpen: () => void) {
    this.beforeOpen = beforeOpen;
    this.trigger.id = 'read-story';
    this.trigger.type = 'button';
    this.trigger.className = 'story-trigger';
    this.trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/></svg><span>拾光手记</span><b aria-hidden="true">✧</b>';
    this.trigger.setAttribute('aria-haspopup', 'dialog');
    this.trigger.setAttribute('aria-controls', 'storybook-dialog');
    document.querySelector('.level-heading .eyebrow')!.append(this.trigger);
    this.whisper.id = 'story-whisper';
    this.whisper.className = 'level-whisper';
    document.getElementById('level-introduction')!.after(this.whisper);

    this.dialog.id = 'storybook-dialog';
    this.dialog.className = 'storybook-dialog';
    this.dialog.setAttribute('aria-labelledby', 'storybook-title');
    this.dialog.innerHTML = '<header class="storybook-heading"><span id="storybook-chapter"></span><button type="button" id="close-story" aria-label="关闭拾光手记">×</button></header><div class="storybook-mark" aria-hidden="true">✧</div><h2 id="storybook-title"></h2><p id="storybook-chapter-letter" class="storybook-chapter-letter"></p><section class="storybook-letter"><h3>出发前 · 给小小拾光人</h3><p id="storybook-letter"></p></section><section id="storybook-reply" class="storybook-reply" hidden><h3>光抵达之后 · 一封回信</h3><p id="storybook-poem"></p></section><p id="storybook-waiting" class="storybook-waiting">等光抵达，这里会留下一封回信。</p><footer><small id="story-reader-note">慢慢读，光会在原处等你。</small><button type="button" id="finish-story" class="primary-button">把光送过去 →</button></footer>';
    document.body.append(this.dialog);
    this.trigger.addEventListener('click', () => {
      this.beforeOpen();
      this.find('close-story').setAttribute('aria-label', '关闭拾光手记');
      this.find('story-reader-note').textContent = '慢慢读，光会在原处等你。';
      if (!this.dialog.open) this.dialog.showModal();
    });
    this.find('close-story').addEventListener('click', () => this.finish());
    this.find('finish-story').addEventListener('click', () => this.finish());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.finish(); });
    this.dialog.addEventListener('click', event => {
      const bounds = this.dialog.getBoundingClientRect();
      if (event.target === this.dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) this.finish();
    });
  }

  private find<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.dialog.querySelector<T>(`#${id}`)!;
  }

  get open(): boolean { return this.dialog.open; }
  // Navigation cancels pending introductions, so an old close cannot open another level's guide.
  close(): void {
    this.openingFinished = null;
    this.dialog.dataset.opening = 'false';
    if (this.open) this.dialog.close();
  }

  private finish(): void {
    const next = this.openingFinished;
    this.close();
    next?.();
  }

  beginOpening(onFinished: () => void): void {
    this.close();
    this.beforeOpen();
    this.openingFinished = onFinished;
    this.dialog.dataset.opening = 'true';
    this.find('close-story').setAttribute('aria-label', '跳过开场，进入本关');
    this.find('story-reader-note').textContent = '读完就出发 · 也可按 Esc 跳过';
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    this.find('finish-story').focus({ preventScroll: true });
  }

  setLevel(level: Level, won: boolean): void {
    this.close();
    const story = lightStories[level.number];
    this.whisper.textContent = story.whisper;
    this.find('storybook-chapter').textContent = `拾光手记 · 第${level.chapter}章 · 第${level.chapterLevel}关`;
    this.find('storybook-title').textContent = level.title;
    this.find('storybook-chapter-letter').textContent = chapterLetters[level.chapter];
    this.find('storybook-letter').textContent = story.letter;
    this.find('storybook-poem').textContent = story.reply;
    this.trigger.setAttribute('aria-label', `阅读${level.title}的拾光手记`);
    this.setWon(won);
    this.find('close-story').setAttribute('aria-label', '关闭拾光手记');
    document.getElementById('completion-title')!.textContent = story.title;
    document.getElementById('completion-text')!.textContent = story.reply;
  }

  setWon(won: boolean): void {
    this.trigger.dataset.replied = String(won);
    this.find('storybook-reply').hidden = !won;
    this.find('storybook-waiting').hidden = won;
    this.find('finish-story').textContent = won ? '继续沿光走 →' : '把光送过去 →';
  }
}
