export const SCENE_THEMES = [
  { id:'day', name:'暖陽車庫', required:0, floor:'#aeb9b5', sky:'#e3edf6', ground:'#637778', sun:'#fff0d6', ambient:.88, key:1.02, environment:.32, sunHeight:9, sunRadius:8 },
  { id:'rain', name:'雨後街景', required:0, floor:'#84969d', sky:'#b5cbdc', ground:'#4e6979', sun:'#e5eaf1', ambient:.86, key:.38, environment:.45 },
  { id:'sunset', name:'黃昏車庫', required:10, floor:'#ac9f97', sky:'#bdcce9', ground:'#665c79', sun:'#ffd09b', ambient:.68, key:1.12, environment:.30, sunHeight:4.6, sunRadius:9.5 },
  { id:'neon', name:'霓虹夜景', required:20, floor:'#182735', sky:'#8dbbdb', ground:'#48416d', sun:'#b5c8ff', ambient:.45, key:.26, environment:.25 },
];
export function completedOfficialLevels(progress={}) {
  return Object.entries(progress).filter(([id,result])=>/^(?:[1-9]|[1-3][0-9]|40)$/.test(id)&&result?.completed===true).length;
}
export const availableTheme = (id, completed) => SCENE_THEMES.find(theme=>theme.id===id&&completed>=theme.required)?.id ?? 'day';
