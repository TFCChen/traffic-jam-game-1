import { completedOfficialLevels, SCENE_THEMES } from './sceneThemes.js';
export const QUALITY = {
  high:{name:'精緻',pixelRatio:2,shadow:2048,activeFPS:60,idleFPS:30,decor:true},
  standard:{name:'標準',pixelRatio:1.5,shadow:1024,activeFPS:60,idleFPS:30,decor:true},
  saver:{name:'省電',pixelRatio:1,shadow:512,activeFPS:30,idleFPS:15,decor:false},
};
export const BADGES=[
  {id:'first',name:'初次出庫',description:'完成第一個正式關卡',check:progress=>completedOfficialLevels(progress)>0},
  {id:'three',name:'三星車手',description:'正式關卡獲得三星',check:progress=>officialResults(progress).some(r=>r.stars===3)},
  {id:'perfect',name:'完美停車',description:'以最佳步數完成正式關卡',check:progress=>officialResults(progress).some(r=>r.perfect===true)},
  {id:'ten',name:'車庫常客',description:'完成十個正式關卡',check:progress=>completedOfficialLevels(progress)>=10},
  {id:'forty',name:'解謎收藏家',description:'完成四十個正式關卡',check:progress=>completedOfficialLevels(progress)===40},
];
function officialResults(progress){return Object.entries(progress??{}).filter(([id,r])=>/^(?:[1-9]|[1-3][0-9]|40)$/.test(id)&&r?.completed===true).map(([,r])=>r);}
export function unlockedRewards(progress){
  const count=completedOfficialLevels(progress);
  return [...BADGES.filter(b=>b.check(progress)).map(b=>({id:b.id,name:b.name,type:'成就徽章'})),...SCENE_THEMES.filter(t=>t.required>0&&count>=t.required).map(t=>({id:t.id,name:t.name,type:'場景解鎖'}))];
}
export function newRewards(previous,next){const owned=new Set(unlockedRewards(previous).map(r=>r.id));return unlockedRewards(next).filter(r=>!owned.has(r.id));}
