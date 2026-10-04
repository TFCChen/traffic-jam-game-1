export const SCENE_THEMES = [
  { id:'day', name:'暖陽車庫', required:0, floor:'#edf0e8', sky:'#fff7e7', ground:'#738a89', sun:'#ffefce', ambient:1.35, key:.9, environment:.3 },
  { id:'sunset', name:'黃昏車庫', required:10, floor:'#d8c0b0', sky:'#ffb785', ground:'#706c91', sun:'#ffb47b', ambient:1.4, key:.85, environment:.45 },
  { id:'neon', name:'霓虹夜景', required:20, floor:'#182735', sky:'#8dbbdb', ground:'#48416d', sun:'#b5c8ff', ambient:.65, key:.38, environment:.35 },
];
export function completedOfficialLevels(progress={}) {
  return Object.entries(progress).filter(([id,result])=>/^(?:[1-9]|[1-3][0-9]|40)$/.test(id)&&result?.completed===true).length;
}
export const availableTheme = (id, completed) => SCENE_THEMES.find(theme=>theme.id===id&&completed>=theme.required)?.id ?? 'day';
