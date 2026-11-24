importScripts('../../common/core.js','logic.js','ai.js');
self.onmessage=({data})=>{try{self.postMessage({id:data.id,move:GoAI.chooseMove(data.state,data.options)});}catch{self.postMessage({id:data.id,error:true});}};
