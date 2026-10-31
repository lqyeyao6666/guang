import type {Level} from './level.ts';
import type {TraceResult} from './optics.ts';
export function installQuantumUI(stage:HTMLElement){
  const ribbon=document.createElement('section');ribbon.id='quantum-controls';ribbon.className='quantum-controls';ribbon.hidden=true;ribbon.setAttribute('aria-label','单光子实验记录');
  ribbon.innerHTML='<span>实验记录</span><b data-record="open">① 开放探测</b><b data-record="b">② B明A暗</b><b data-record="a">③ A明B暗</b><small id="quantum-mode">准备区未通电</small>';stage.before(ribbon);
  const panel=document.createElement('div');panel.id='quantum-status';panel.className='quantum-status';panel.hidden=true;panel.setAttribute('role','status');
  panel.innerHTML='<div><b>光电流 / 门槛</b><span id="quantum-current"></span></div><div><b>A探测概率</b><span id="quantum-a"></span></div><div><b>B探测概率</b><span id="quantum-b"></span></div><div><b>干涉对比度</b><span id="quantum-visibility"></span></div><div><b>光程差 / 刻度</b><span id="quantum-phase"></span></div><div><b>C / D轨道位置</b><span id="quantum-rails"></span></div><p id="quantum-message"></p><small>概率含损耗，按每次发射计算。基础布局改变会清空记录；滑轨微调与装卸合束镜可保留。</small>';
  document.querySelector('#waypoint-status')!.before(panel);
}
export function updateQuantumUI(level:Level,trace:TraceResult){
  const s=trace.quantum;document.querySelector<HTMLElement>('#quantum-controls')!.hidden=!level.quantum;document.querySelector<HTMLElement>('#quantum-status')!.hidden=!level.quantum;if(!s)return;
  const text=(id:string,value:string)=>document.querySelector(`#${id}`)!.textContent=value;
  text('quantum-current',`${s.currentMicroamps.toFixed(3)} / 0.330 μA`);text('quantum-a',`${(s.probabilityA*100).toFixed(1)}%`);text('quantum-b',`${(s.probabilityB*100).toFixed(1)}%`);
  text('quantum-visibility',`${Math.round(s.visibility*100)}%`);text('quantum-phase',s.arms.every(a=>a.arrived)&&s.arms.length===2?`${(s.arms[0].opticalLength-s.arms[1].opticalLength).toFixed(2)}`:'等待两路');
  text('quantum-rails',level.items.filter(i=>i.rail).map(i=>i.x.toFixed(1)).join(' / '));text('quantum-message',s.message);text('quantum-mode',!s.powered?'准备区未通电':s.closed?'合束干涉':'开放探测');
  document.querySelectorAll<HTMLElement>('[data-record]').forEach(el=>{const key=el.dataset.record as 'open'|'a'|'b';el.classList.toggle('recorded',s.recordsValid&&s.records[key]);el.setAttribute('aria-label',`${el.textContent}：${s.recordsValid&&s.records[key]?'已记录':'待记录'}`);});
}
export function updateQuantumCounts(a:number,b:number):void {
  for(const [side,count]of [['a',a],['b',b]]as const){const span=document.querySelector<HTMLElement>(`#quantum-${side}`);if(!span)continue;const probability=span.textContent!.split(' · ')[0];span.textContent=`${probability} · ${count}次`;span.setAttribute('aria-label',`探测概率${probability}，累计${count}次单光子点击`);}
}
