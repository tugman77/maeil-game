importScripts('../../common/core.js','logic.js','ai.js');
self.onmessage=({data})=>{
  try{const report=JanggiAI.analyze(data.state,data.options||{});self.postMessage({id:data.id,move:report.move,report});}
  catch{self.postMessage({id:data.id,error:true});}
};
