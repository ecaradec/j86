
//
// Transform Psi function to IR
//
function psiToIRTransform(n) {
    if(n.visited == 'psi2ir')
        return;
    n.visited = 'psi2ir';
    for(var p in n.psi) {
        var psi = n.psi[p];
        var inputs = psi.slice(1);
        for(var i in inputs) {
            var ass = inputs[i].src.assembly;
            var lastJump = undefined;
            var lastCond = undefined;
            if(ass[ass.length-1].op == 'JMP' || ass[ass.length-1].op == 'ifFalse' || ass[ass.length-1].op == 'ifTrue') {
                lastJump = ass.pop();
                if(ass[ass.length-1].w.v == '$cond')
                    lastCond = ass.pop();
            }
            
            inputs[i].src.emit({ op: '=', w: psi[0], r1: inputs[i] });
            if(lastCond) {
                ass.push(lastCond);
            }            
            if(lastJump) {
                ass.push(lastJump);                
            }            
        }
    }
    delete n.psi;
    for(var i in n.children) {
        psiToIRTransform(n.children[i]);
    }
}

module.exports = psiToIRTransform;