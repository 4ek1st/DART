(function(root) {
  'use strict';
  const nativeControls = 'input, textarea, select, [contenteditable], video, audio, iframe, ' +
    '[role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"], [role="tree"], [role="tablist"]';
  function direction(event, focused) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
        [focused, event.target].some(node => node?.isContentEditable || node?.closest?.(nativeControls))) return 0;
    if (event.shiftKey && /^(ArrowUp|ArrowDown)$/.test(event.code || event.key)) return 0;
    if (event.code === 'KeyS' || event.code === 'ArrowDown' || ['s','S','ArrowDown'].includes(event.key)) return 1;
    if (event.code === 'KeyW' || event.code === 'ArrowUp' || ['w','W','ArrowUp'].includes(event.key)) return -1;
    return 0;
  }
  function target(start, owner, style = node => root.getComputedStyle(node)) {
    if (!owner) return null;
    if (!start || start !== owner && !owner.contains?.(start)) return owner;
    for (let node=start;node && node!==owner;node=node.parentElement)
      if (node.scrollHeight > node.clientHeight + 1 && /^(auto|scroll)$/.test(style(node).overflowY)) return node;
    return owner;
  }
  function create({requestFrame = callback => root.requestAnimationFrame(callback),
    cancelFrame = id => root.cancelAnimationFrame(id), now = () => root.performance.now(),
    allowed = () => true, reducedMotion = () => false} = {}) {
    let frameId=null, element=null, scope, goal=0, sign=0, last=0, inputAt=0;
    const maximum = node => Math.max(0, node.scrollHeight - node.clientHeight);
    const clamp = (value,max) => Math.max(0,Math.min(max,value));
    const write = (node,top) => node.scrollTo ? node.scrollTo({top,behavior:'instant'}) : node.scrollTop=top;
    function cancel() {
      if (frameId !== null) cancelFrame(frameId);
      frameId=null; element=null; scope=undefined; sign=0;
    }
    function frame(time) {
      frameId=null;
      if (!element || element.isConnected === false || !allowed(scope,element)) { cancel();return; }
      const max=maximum(element), current=element.scrollTop;
      goal=clamp(goal,max);
      const difference=goal-current, dt=Math.max(1,time-last);last=time;
      if (Math.abs(difference)<1 || time-inputAt>=160 || reducedMotion()) { write(element,goal);cancel();return; }
      write(element,clamp(current+difference*(1-Math.exp(-dt/35)),max));
      frameId=requestFrame(frame);
    }
    return {
      step(node,step,owner) {
        if (!node || !step || node.isConnected === false || !allowed(owner,node)) return false;
        const current=node.scrollTop, max=maximum(node), nextSign=Math.sign(step);
        const same=element===node && scope===owner && sign===nextSign;
        const distance=Math.max(40,Math.min(100,node.clientHeight*.1));
        const backlog=Math.max(distance,node.clientHeight*.5);
        const next=clamp(Math.max(current-backlog,Math.min(current+backlog,(same?goal:current)+distance*nextSign)),max);
        if (!same) cancel();
        if (Math.abs(next-current)<.5) { cancel();return false; }
        if (reducedMotion()) { cancel();write(node,next);return true; }
        element=node;scope=owner;sign=nextSign;goal=next;inputAt=now();
        if (frameId === null) { last=now();frameId=requestFrame(frame); }
        return true;
      }, cancel, dispose:cancel
    };
  }
  function attach(document, {owner, scope = () => null} = {}) {
    const view=document.defaultView || root;
    let pointer=null, disposed=false, activeScope;
    const motion=view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const engine=create({
      requestFrame:callback=>view.requestAnimationFrame(callback),cancelFrame:id=>view.cancelAnimationFrame(id),
      now:()=>view.performance.now(), reducedMotion:()=>motion?.matches,
      allowed:(saved,node)=>!disposed && saved.scope===scope() && saved.root===owner() &&
        (node===saved.root || saved.root.contains(node)) && !directionBlocked()
    });
    const directionBlocked=()=>document.activeElement?.isContentEditable || document.activeElement?.closest?.(nativeControls);
    const move=event=>{pointer=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?{x:event.clientX,y:event.clientY}:null;};
    const leave=()=>{pointer=null;};
    const cancel=()=>engine.cancel();
    const keydown=event=>{
      const step=direction(event,document.activeElement), active=step && owner();
      if (!active) return;
      const pointed=pointer && document.elementFromPoint(pointer.x,pointer.y);
      const start=pointed && active.contains(pointed)?pointed:
        document.activeElement && active.contains(document.activeElement)?document.activeElement:event.target;
      const node=target(start,active,element=>view.getComputedStyle(element));
      if (!(node?.scrollHeight > node.clientHeight + 1)) return;
      event.preventDefault();
      const current=scope();
      if (!activeScope || activeScope.root!==active || activeScope.scope!==current) activeScope={root:active,scope:current};
      engine.step(node,step,activeScope);
    };
    const listeners=[
      [document,'keydown',keydown,false],[document,'pointermove',move,{passive:true}],
      [document,'pointerleave',leave,false],[document,'wheel',cancel,{capture:true,passive:true}],
      [document,'pointerdown',cancel,true],[document,'focusin',cancel,false],
      [document,'visibilitychange',cancel,false],[view,'blur',cancel,false]
    ];
    for (const [node,type,handler,options] of listeners) node.addEventListener(type,handler,options);
    function dispose() {
      if (disposed) return;
      disposed=true;engine.dispose();pointer=null;
      for (const [node,type,handler,options] of listeners) node.removeEventListener(type,handler,options);
      view.removeEventListener('beforeunload',dispose);
    }
    view.addEventListener('beforeunload',dispose,{once:true});
    return {cancel,dispose};
  }
  const api={direction,target,create,attach};
  root.DartKeyboardScroll=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
