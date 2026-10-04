export const SCENE_THEMES = [
  { id:'day', name:'暖陽車庫', required:0, floor:'#b8c6bd', sky:'#fff7e7', ground:'#738a89', sun:'#ffefce', ambient:1.2, key:.9, environment:.35 },
  { id:'sunset', name:'黃昏車庫', required:10, floor:'#bc9e8e', sky:'#ffb785', ground:'#706c91', sun:'#ffb47b', ambient:1.25, key:.85, environment:.45 },
  { id:'neon', name:'霓虹夜景', required:20, floor:'#182735', sky:'#8dbbdb', ground:'#48416d', sun:'#b5c8ff', ambient:.45, key:.26, environment:.25 },
];
export function completedOfficialLevels(progress={}) {
  return Object.entries(progress).filter(([id,result])=>/^(?:[1-9]|[1-3][0-9]|40)$/.test(id)&&result?.completed===true).length;
}
export const availableTheme = (id, completed) => SCENE_THEMES.find(theme=>theme.id===id&&completed>=theme.required)?.id ?? 'day';
