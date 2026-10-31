import type { Level, ItemKind } from './level.ts';

const descriptions: Partial<Record<ItemKind, string>> = {
  mirror: '双面反射，让光转弯。右键选择镜面朝向。',
  lens: '沿光轴聚光，焦点在前方两格。',
  concaveLens: '让光向外展开，铺满更宽的接收区域。',
  liftMirror: '沿箭头接光，让水平光向上穿过洞口。',
  balloonMirror: '接住洞口升起的光，再沿箭头水平送出。',
  prism: '箭头顺着白光，将它分为七种颜色。',
  coreMirror: '放在中央圆座，一部分光汇入光心，余光继续接力。',
  beamSplitter: '在插座上合束，让两条可能通道产生干涉。',
  source: '光从这里出发，位置与方向由本关固定。',
  beacon: '把光送到这里；亮度和本关条件同时满足后点亮。',
  waypoint: '让光真正穿过圆环，再继续送达终点。',
  cubeWaypoint: '穿过当前面的圆环，再将这一路送入光心。',
  photocell: '接收适合频率的光，光电流控制独立电源。',
  photonSource: '独立供电的单光子源，每次发射至多探测一次。',
  photonDetector: '记录探测概率与单次落点，注意两路实验条件。',
  hay: '拖开稻草给牛让路，也可以收回物品栏。',
  block: '会挡住光；可移动的挡光块可拖走或收纳。',
};

/** A single overlay over the existing scene. No extra rendering loop. */
export class GameHud {
  private readonly inventory = document.getElementById('inventory')!;
  private readonly controls = document.createElement('div');
  private readonly meter = document.createElement('div');
  private readonly toggle = document.createElement('button');
  private readonly details = document.createElement('div');
  private readonly scroll = document.createElement('div');
  private readonly previous = document.createElement('button');
  private readonly next = document.createElement('button');
  private readonly observer: ResizeObserver;
  expanded = false;
  insets = { top: 100, bottom: 110 };

  constructor(private readonly stage: HTMLElement, private readonly options: {
    onExpand: () => void;
    onInsets: (top: number, bottom: number) => void;
  }) {
    stage.prepend(document.querySelector('.level-heading')!);
    const settings = document.getElementById('settings-dialog')!;
    const navigation = document.createElement('div');
    navigation.className = 'pause-actions'; navigation.id = 'pause-actions';
    navigation.append(document.getElementById('restart')!, document.getElementById('return-home')!);
    settings.querySelector('.settings-heading')!.after(navigation);
    const gear = document.getElementById('open-settings')!;
    gear.setAttribute('aria-label', '设置与暂停'); gear.setAttribute('title', '设置与暂停');
    gear.querySelector('span')!.remove();

    this.meter.id = 'brightness';
    this.meter.innerHTML = '<div class="brightness-labels" aria-hidden="true"><span id="brightness-current">0%</span><span class="brightness-target"><i></i><span id="brightness-goal">30%</span></span></div><div class="brightness-line" role="meter" aria-label="信标接收亮度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="brightness-fill"></span><i id="brightness-tick"></i></div><span class="brightness-ready" aria-hidden="true"></span>';
    document.getElementById('open-settings')!.before(this.meter);

    this.controls.className = 'hud-level-controls'; this.controls.id = 'hud-level-controls';
    for (const id of ['layer-controls', 'cube-controls', 'photo-controls', 'quantum-controls']) this.controls.append(document.getElementById(id)!);
    stage.append(this.controls);
    stage.append(document.getElementById('layer-guide')!);

    // Full descriptions and scientific readouts live inside the expanded tray.
    this.details.id = 'inventory-details'; this.details.className = 'inventory-details'; this.details.hidden = true;
    this.details.append(document.querySelector('.receiver-card')!, document.querySelector('.journey-card')!);
    const gauge = this.details.querySelector('.energy-gauge')!;
    gauge.querySelector('svg')!.remove();
    this.inventory.prepend(this.details);
    this.toggle.type = 'button'; this.toggle.id = 'toggle-inventory';
    this.toggle.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 12 5-5 5 5"/></svg>';
    this.toggle.setAttribute('aria-controls', 'inventory-details');
    this.toggle.addEventListener('click', () => { this.options.onExpand(); this.setExpanded(!this.expanded); });
    this.inventory.prepend(this.toggle);
    this.inventory.dataset.expanded = 'false';
    const title = this.inventory.querySelector(':scope > .card-top')!;
    this.inventory.prepend(title);
    const items = this.inventory.querySelector('.inventory-items')!;
    this.scroll.className = 'inventory-strip'; this.scroll.append(items);
    for (const [button, id, label, glyph, direction] of [
      [this.previous, 'inventory-previous', '向前查看物品', '‹', -1],
      [this.next, 'inventory-next', '向后查看物品', '›', 1],
    ] as const) {
      button.id = id; button.type = 'button'; button.className = 'inventory-page';
      button.textContent = glyph; button.setAttribute('aria-label', label);
      button.addEventListener('click', () => items.scrollBy({ left: direction * 160, behavior: 'instant' }));
    }
    this.scroll.prepend(this.previous); this.scroll.append(this.next);
    this.inventory.append(this.scroll, this.details, document.getElementById('return-zone')!);
    stage.append(this.inventory);
    document.querySelector('.sidebar')!.remove();
    for (const row of this.inventory.querySelectorAll<HTMLElement>('[data-kind]')) {
      const description = document.createElement('p'); description.className = 'item-description';
      description.textContent = descriptions[row.dataset.kind as ItemKind] ?? '按本关的装置说明使用。';
      row.querySelector('.inventory-name')!.append(description);
    }
    // The old inspiration card is gone; optional graded help remains in Settings.
    const help = document.createElement('details'); help.className = 'settings-section pause-help';
    help.innerHTML = '<summary>关卡提示</summary>';
    help.append(document.getElementById('hint')!, document.getElementById('hint-content')!);
    settings.querySelector('#settings-saved')!.before(help);
    document.getElementById('hint')!.querySelector('span')!.textContent = '查看本关提示';
    this.observer = new ResizeObserver(() => this.measure());
    for (const target of [stage, this.controls, stage.querySelector('.level-heading')!, items]) this.observer.observe(target);
    this.setExpanded(false);
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.inventory.dataset.expanded = String(expanded);
    this.toggle.setAttribute('aria-expanded', String(expanded));
    this.toggle.setAttribute('aria-label', expanded ? '收起物品栏' : '展开物品栏与器件说明');
    this.toggle.title = expanded ? '收起物品栏' : '展开物品栏';
    this.details.hidden = !expanded;
    this.scroll.scrollTop = 0;
    this.inventory.querySelector('.inventory-items')!.scrollLeft = 0;
    if (!expanded) this.details.scrollTop = 0;
    this.measure();
  }

  setHome(home: boolean): void { document.getElementById('pause-actions')!.hidden = home; }

  update(level: Level, energy: number, ready: boolean): void {
    const hasReport = !!(level.cube || level.aquarium || level.photoelectric || level.quantum || level.fusion || level.setting === 'rural' || level.items.some(item => item.kind === 'waypoint' || item.kind === 'colorWaypoint'));
    this.details.querySelector<HTMLElement>('.journey-card')!.hidden = !hasReport;
    this.details.classList.toggle('single-goal', !hasReport);
    const percent = Math.round(Math.max(0, energy) * 100);
    const target = Math.round(level.threshold * 100);
    const label = `${level.quantum ? '探测概率' : '接收亮度'} ${percent}%，目标 ${target}%；${ready ? '全部条件已满足' : '仍需完成本关光路条件'}`;
    const line = this.meter.querySelector<HTMLElement>('[role=meter]')!;
    line.setAttribute('aria-valuenow', String(Math.min(percent, 100)));
    line.setAttribute('aria-valuetext', label);
    this.meter.title = label;
    this.meter.dataset.ready = String(ready);
    this.meter.style.setProperty('--target', `${target}%`);
    document.getElementById('brightness-goal')!.textContent = `${target}%`;
    document.getElementById('brightness-current')!.textContent = `${percent}%`;
    document.getElementById('brightness-fill')!.style.width = `${Math.min(100, percent)}%`;
  }

  measure(): void {
    const bounds = this.stage.getBoundingClientRect();
    if (!bounds.height || !bounds.width) return;
    const titleBottom = this.stage.querySelector('.level-heading')!.getBoundingClientRect().bottom - bounds.top;
    this.controls.style.top = `${Math.ceil(titleBottom + 12)}px`;
    const controlBottom = this.controls.getBoundingClientRect().bottom - bounds.top;
    const hasControls = [...this.controls.children].some(child => !(child as HTMLElement).hidden);
    const top = Math.min(bounds.height * .33, Math.ceil((hasControls ? controlBottom : titleBottom) + 16));
    const bottom = bounds.height < 500 ? 83 : 115;
    if (this.insets.top !== top || this.insets.bottom !== bottom) {
      this.insets = { top, bottom }; this.options.onInsets(top, bottom);
    }
    const items = this.inventory.querySelector<HTMLElement>('.inventory-items')!;
    this.inventory.classList.toggle('has-overflow', !this.expanded && items.scrollWidth > items.clientWidth + 1);
  }
}
