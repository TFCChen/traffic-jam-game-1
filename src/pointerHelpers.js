export const snapDragDelta = delta => Math.sign(delta)*Math.floor(Math.abs(delta)+.58);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function quadDistance(point,quad){
  let inside=false,min=Infinity;
  for(let i=0,j=quad.length-1;i<quad.length;j=i++){
    const a=quad[i],b=quad[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    min=Math.min(min,segmentDistance(point,a,b));
  }
  return inside?0:min;
}
