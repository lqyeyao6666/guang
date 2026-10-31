import './credits.css';

// Credits match the shipped recordings in public/music/tracks.json and CREDITS.txt.
const musicCredits = [
  {
    chapter: '第一章 · 初见光',
    title: 'Calm Piano 1 (Vaporware)',
    creator: 'The Cynic Project / cynicmusic',
    source: 'https://opengameart.org/content/calm-piano-1-vaporware',
  },
  {
    chapter: '第二章 · 黑夜',
    title: 'Heavenly Loop',
    creator: 'isaiah658',
    source: 'https://opengameart.org/content/heavenly-loop',
  },
  {
    chapter: '第三章 · 光的实验',
    title: 'Calm Ambient 1 (Synthwave 4k)',
    creator: 'The Cynic Project / cynicmusic',
    source: 'https://opengameart.org/content/calm-ambient-1-synthwave-4k',
  },
] as const;

/** One shared section is available from both the home and gameplay settings. */
export function installCreatorCredits(settings: HTMLDialogElement): void {
  const section = document.createElement('details');
  section.id = 'creator-credits';
  section.className = 'settings-section credits-section';
  section.innerHTML = `
    <summary>创作者名单</summary>
    <div class="credits-body">
      <div class="creator-credit"><span>游戏创作</span><strong>尧尧</strong><p>《暖光小径》</p></div>
      <h3>音乐致谢</h3>
      <ol class="music-credits">${musicCredits.map(track => `
        <li><span class="credit-chapter">${track.chapter}</span><h4>${track.title}</h4><p class="credit-author">${track.creator}</p><div class="credit-source"><span>CC0 1.0</span><a href="${track.source}" target="_blank" rel="noopener noreferrer" aria-label="${track.title} 的 OpenGameArt 原始作品页（新窗口打开）">OpenGameArt · 原始作品 ↗</a></div></li>
      `).join('')}</ol>
      <p class="credits-thanks">特别感谢音乐创作者分享这些作品。</p>
      <p class="credits-attribution">The Cynic Project / <a href="https://cynicmusic.com/" target="_blank" rel="noopener noreferrer">cynicmusic.com</a> / <a href="https://pixelsphere.org/" target="_blank" rel="noopener noreferrer">pixelsphere.org</a><br>isaiah658</p>
    </div>`;
  settings.querySelector('#settings-saved')!.before(section);
}
