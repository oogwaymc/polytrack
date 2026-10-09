// Replaces the Electron desktop bridge so PolyTrack runs in a normal browser.
(function(){
  var d=document;
  window.electron={
    quit:function(){ try{window.close();}catch(e){} },
    addFullscreenChangeListener:function(cb){ d.addEventListener('fullscreenchange',function(){cb();}); },
    isFullscreen:function(){ return !!d.fullscreenElement; },
    setFullscreen:function(on){
      try{ if(on&&!d.fullscreenElement) d.documentElement.requestFullscreen().catch(function(){});
           else if(!on&&d.fullscreenElement) d.exitFullscreen().catch(function(){}); }catch(e){}
    },
    getArgv:function(){ return []; },
    log:function(m){ console.log(m); }
  };
  d.addEventListener('keydown',function(e){
    if(!e.repeat&&(e.code==='F11'||(e.altKey&&e.code==='Enter'))){e.preventDefault();window.electron.setFullscreen(!d.fullscreenElement);}
  });
})();
