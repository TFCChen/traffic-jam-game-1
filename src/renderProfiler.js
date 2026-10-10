// Opt-in diagnostics: asynchronous GPU timers never wait for a GPU result.
export function createRenderProfiler(gl){
  const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let enabled=false,active,start;const pending=[],cpu=[],gpu=[],calls=[],triangles=[];
  const keep=(list,value)=>{list.push(value);if(list.length>300)list.shift();};
  function clearQueries(){if(active){gl.endQuery(extension.TIME_ELAPSED_EXT);gl.deleteQuery(active);active=null;}pending.splice(0).forEach(q=>gl.deleteQuery(q));}
  const summarize=list=>{const sorted=[...list].sort((a,b)=>a-b);return {samples:list.length,median:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]??null};};
  return {
    set(value){enabled=value;clearQueries();if(value)[cpu,gpu,calls,triangles].forEach(list=>list.length=0);},
    begin(){if(!enabled)return;if(extension){
      if(gl.getParameter(extension.GPU_DISJOINT_EXT)){clearQueries();gpu.length=0;}
      while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=pending.shift();keep(gpu,gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
      if(pending.length<4){active=gl.createQuery();gl.beginQuery(extension.TIME_ELAPSED_EXT,active);}
    }start=performance.now();},
    end(info){if(!enabled)return;keep(cpu,performance.now()-start);keep(calls,info.calls);keep(triangles,info.triangles);if(active){gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(active);active=null;}},
    snapshot(){return {cpuMs:summarize(cpu),gpuMs:summarize(gpu),drawCalls:summarize(calls),triangles:summarize(triangles),gpuTimer:!!extension};},
    dispose(){clearQueries();},
  };
}
