import { PHOTO_WAVELENGTHS } from './photoelectric-level.ts';
import { SPECTRUM } from './level.ts';
import type { Level } from './level.ts';
import type { TraceResult } from './optics.ts';

export function installPhotoelectricUI(stage:HTMLElement):void {
  const controls=document.createElement('section');controls.id='photo-controls';controls.className='photo-controls';controls.hidden=true;controls.setAttribute('aria-label','单色光源控制');
  controls.innerHTML=`<div class="photo-wavelengths"><span>单色光</span>${PHOTO_WAVELENGTHS.map(w=>`<button type="button" data-wavelength="${w.nm}" style="--band:${SPECTRUM.find(s=>s.id===w.color)!.color}" aria-pressed="false">${w.name}<small>${w.nm}nm</small></button>`).join('')}</div><label class="photo-intensity-label" for="photo-intensity">光强 <input id="photo-intensity" type="range" min="25" max="100" step="5" value="50"/><output id="photo-intensity-value" for="photo-intensity">50%</output></label>`;
  stage.before(controls);
  const panel=document.createElement('div');panel.id='photoelectric-status';panel.className='photoelectric-status';panel.hidden=true;panel.setAttribute('role','status');
  panel.innerHTML='<div><b>单个光子</b><span id="photon-energy">—</span></div><div><b>电子动能上限</b><span id="electron-energy">—</span></div><div><b>光电流</b><span id="photo-current">0 μA</span></div><div><b>右区电源</b><span id="photo-relay">未接通</span></div><div><b>花灯覆盖</b><span id="photo-coverage">0%</span></div><p>钠阴极模型 Φ≈2.46eV，截止波长≈504nm。<br>光电流控制继电器；右区由独立电源供电。</p>';
  document.querySelector('#waypoint-status')!.before(panel);
}

export function updatePhotoelectricUI(level:Level,trace:TraceResult):void {
  const config=level.photoelectric,state=trace.photoelectric;
  document.querySelector<HTMLElement>('#photo-controls')!.hidden=!config;
  document.querySelector<HTMLElement>('#photoelectric-status')!.hidden=!config;
  if(!config||!state)return;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-wavelength]'))button.setAttribute('aria-pressed',String(Number(button.dataset.wavelength)===config.wavelengthNm));
  const slider=document.querySelector<HTMLInputElement>('#photo-intensity')!;slider.value=String(Math.round(config.intensity*100));
  document.querySelector('#photo-intensity-value')!.textContent=`${Math.round(config.intensity*100)}%`;
  document.querySelector('#photon-energy')!.textContent=`${state.photonEv.toFixed(2)} eV`;
  document.querySelector('#electron-energy')!.textContent=state.maxKineticEv===null?'未逸出电子':`${state.maxKineticEv.toFixed(2)} eV`;
  document.querySelector('#photo-current')!.textContent=`${state.currentMicroamps.toFixed(2)} / ${config.relayThresholdMicroamps.toFixed(2)} μA`;
  document.querySelector('#photo-relay')!.textContent=state.relayOn?'已接通':state.emitting?'有电子 · 电流偏小':'等待光电流';
  document.querySelector('#photo-coverage')!.textContent=`${Math.round(state.coverage*100)}%`;
  const electrode=document.querySelector<HTMLElement>('[data-item="photocathode"]');if(electrode)electrode.textContent=state.relayOn?'感光板 · 电流达标':state.emitting?'感光板 · 有光电流':'感光板 · Na';
  const powered=document.querySelector<HTMLElement>('[data-item="powered-source"]');if(powered)powered.textContent=state.relayOn?'电源灯 · 已接通':'电源灯 · 等待通电';
}
