"use strict";

// Preserve the session identity: deferred writer setup adds the token expiry
// and Sheets adapter after this wrapper is installed. Future foreground
// operators must import this helper instead of copying the session object.
function wrapClosingSession(session,{human,native}) {
  const wrap=(group,kind)=>Object.fromEntries(Object.entries(group??{}).map(([name,fn])=>[name,async(...args)=>{
    human.beginClosing();native.beginClosing();
    if(native.isInFlight()&&(kind==="inspect"||name==="file"))throw Error("native_action_unsettled");
    return fn.apply(group,args);
  }]));
  session.inspect=wrap(session.inspect,"inspect");
  session.cleanup=wrap(session.cleanup,"cleanup");
  return session;
}
module.exports={wrapClosingSession};
