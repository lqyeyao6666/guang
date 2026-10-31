import './journey-menu.css';
import { levelSummaries } from './level.ts';
import type { LevelNumber } from './level.ts';
import { GameProgress, isUnlocked } from './progress.ts';

const chapterNames = ['初见光', '黑夜', '光的实验'];

/** Home selection and the optional settings tool share the same access rules. */
export class JourneyMenu {
  readonly dialog = document.createElement('dialog');
  private readonly debug = document.createElement('details');

  constructor(private readonly progress: GameProgress, options: {
    onSelect: (number: LevelNumber) => void;
    onDebugSelect: (number: LevelNumber) => void;
    onReset: () => void;
    onDebugExit: () => void;
  }) {
    this.dialog.id = 'levels-dialog';
    this.dialog.setAttribute('aria-labelledby', 'levels-title');
    this.dialog.innerHTML = `<div class="settings-heading"><div><div class="eyebrow">ALONG THE LITTLE PATH</div><h2 id="levels-title">沿光选关</h2></div><button id="close-levels" class="close-button" type="button" aria-label="关闭关卡选择">×</button></div><p id="journey-progress" class="journey-progress"></p><p id="level-access-note" class="level-access-note" role="status"></p><div class="chapter-levels">${chapterNames.map((name, i) => `<section data-chapter-group="${i + 1}"><h3><small>0${i + 1}</small>${name}</h3><div class="chapter-level-grid">${levelSummaries.filter(entry => entry.chapter === i + 1).map(entry => `<button type="button" data-choose-level="${entry.number}"><span class="level-index">${String(entry.chapterLevel).padStart(2, '0')}</span><span class="level-card-copy"><strong>${entry.title}</strong><small>${entry.topic}</small></span><span class="level-card-state"></span></button>`).join('')}</div></section>`).join('')}</div><p class="journey-storage-note">每完成一关，就会点亮下一段小径。进度保存在本机浏览器。</p>`;
    document.body.append(this.dialog);
    this.dialog.querySelector('#close-levels')!.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', event => {
      if (event.target !== this.dialog) return;
      const b = this.dialog.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) this.dialog.close();
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-choose-level]').forEach(button => button.addEventListener('click', () => {
      const number = Number(button.dataset.chooseLevel) as LevelNumber;
      if (!progress.canPlay(number)) return;
      this.dialog.close(); options.onSelect(number);
    }));

    this.debug.id = 'debug-tools';
    this.debug.className = 'settings-section debug-tools';
    this.debug.innerHTML = `<summary>开发调试</summary><form id="debug-login" class="debug-login"><label for="debug-password">调试密码</label><div class="debug-password-row"><input id="debug-password" type="password" autocomplete="off" inputmode="numeric" aria-describedby="debug-message"/><button class="quiet-button" type="submit">进入</button></div></form><div id="debug-panel" hidden><p class="debug-help">本标签页可自由选关；调试跳关不会补记前面的通关进度。</p><label for="debug-level">前往关卡</label><div class="debug-password-row"><select id="debug-level">${levelSummaries.map(entry => `<option value="${entry.number}">第${entry.chapter}章 · ${entry.chapterLevel}　${entry.title}</option>`).join('')}</select><button id="debug-jump" class="quiet-button" type="button">前往</button></div><div class="debug-actions"><button id="reset-progress" class="quiet-button" type="button" aria-describedby="reset-progress-description" aria-controls="reset-progress-confirm" aria-expanded="false">重置游戏</button><button id="exit-debug" class="quiet-button" type="button">退出调试</button></div><p id="reset-progress-description" class="debug-reset-note">清空通关与解锁进度，从第一关重新开始。</p><div id="reset-progress-confirm" role="group" aria-label="重置游戏确认" hidden><p>确定重置游戏吗？将清空全部通关记录、退出调试并返回主界面，只解锁第一关。视角、音乐和音效设置保留。</p><div class="debug-actions"><button id="confirm-reset-progress" class="quiet-button" type="button">确认重置</button><button id="cancel-reset-progress" class="quiet-button" type="button">取消</button></div></div></div><p id="debug-message" class="debug-message" role="status" aria-live="polite"></p>`;
    document.querySelector('#settings-saved')!.before(this.debug);
    this.debug.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault();
      const input = this.debug.querySelector<HTMLInputElement>('#debug-password')!;
      const accepted = progress.authenticate(input.value);
      input.value = '';
      this.refresh();
      this.message(accepted ? '调试已开启，仅对本标签页生效。' : '密码不正确，请重试。');
      if (accepted) this.debug.querySelector<HTMLSelectElement>('#debug-level')!.focus();
      else input.focus();
    });
    this.debug.querySelector('#debug-jump')!.addEventListener('click', () => {
      if (!progress.debug) return;
      options.onDebugSelect(Number(this.debug.querySelector<HTMLSelectElement>('#debug-level')!.value) as LevelNumber);
    });
    this.debug.querySelector('#reset-progress')!.addEventListener('click', () => {
      if (progress.debug) { this.confirmReset(true); this.debug.querySelector<HTMLButtonElement>('#cancel-reset-progress')!.focus(); }
    });
    this.debug.querySelector('#cancel-reset-progress')!.addEventListener('click', () => this.confirmReset(false));
    this.debug.querySelector('#confirm-reset-progress')!.addEventListener('click', () => {
      if (!progress.debug) return;
      progress.reset(); progress.setDebug(false); this.refresh(); options.onReset();
    });
    this.debug.querySelector('#exit-debug')!.addEventListener('click', () => {
      progress.setDebug(false); this.refresh(); this.message('已退出调试，恢复逐关解锁。'); options.onDebugExit();
    });
    document.querySelector('#settings-dialog')!.addEventListener('close', () => {
      this.confirmReset(false);
      this.debug.querySelector<HTMLInputElement>('#debug-password')!.value = '';
    });
    this.refresh();
  }

  private confirmReset(show: boolean): void {
    const confirmation = this.debug.querySelector<HTMLElement>('#reset-progress-confirm')!;
    const button = this.debug.querySelector<HTMLButtonElement>('#reset-progress')!;
    const restoreFocus = !show && confirmation.contains(document.activeElement);
    confirmation.hidden = !show;
    button.setAttribute('aria-expanded', String(show));
    if (restoreFocus && this.progress.debug) button.focus();
  }
  private message(value: string): void { this.debug.querySelector('#debug-message')!.textContent = value; }

  refresh(): void {
    this.dialog.querySelector('#journey-progress')!.textContent = `已点亮 ${this.progress.data.completed.length} / ${levelSummaries.length} 段小径`;
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>('[data-choose-level]')) {
      const number = Number(button.dataset.chooseLevel) as LevelNumber;
      const complete = this.progress.data.completed.includes(number);
      const unlocked = isUnlocked(this.progress.data, number);
      button.disabled = !this.progress.canPlay(number);
      button.dataset.status = complete ? 'complete' : unlocked ? 'available' : 'locked';
      const state = complete ? '已通关 ✓' : unlocked ? '可游玩' : this.progress.debug ? '调试可进入' : '未解锁';
      button.querySelector('.level-card-state')!.textContent = state;
      button.setAttribute('aria-label', `${button.querySelector('strong')!.textContent}，${state}`);
    }
    this.debug.querySelector<HTMLElement>('#debug-login')!.hidden = this.progress.debug;
    this.debug.querySelector<HTMLElement>('#debug-panel')!.hidden = !this.progress.debug;
    this.confirmReset(false);
  }

  show(note = ''): void {
    this.refresh();
    this.dialog.querySelector('#level-access-note')!.textContent = note;
    this.dialog.showModal(); this.dialog.scrollTop = 0;
  }

  get open(): boolean { return this.dialog.open; }
}
