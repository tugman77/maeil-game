importScripts('../../common/core.js','logic.js');
self.onmessage=({data})=>{
  try{
    const state=data.state;
    if(state.difficulty==='easy'&&!data.options?.assessOnly){
      // Easy retains its occasional mistakes; outcome proofs are independent.
      const move=Omok.chooseMove(state),report=Omok.analyze(state,{...data.options,assessOnly:true,timeMs:250});
      self.postMessage({id:data.id,move,report,rng:state.rng});
    }else{const report=Omok.analyze(state,data.options||{});self.postMessage({id:data.id,move:report.move,report,rng:state.rng});}
  }catch{self.postMessage({id:data.id,error:true});}
};
