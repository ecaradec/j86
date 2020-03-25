
//
// Transform Psi function to IR
//
function psiToIRTransform(n) {
    if(n.visited == 'psi2ir')
        return;
    n.visited = 'psi2ir';

    for(var p in n.phis) {
        var phi = n.phis[p];

        // the first value in psi is the variable name to write
        // the remaining are the value to select
        // each value know in src, from which block it was know
        for(var i in phi.r) {
            var ass = n.parents[i].assembly;
            var lastJump = undefined;
            var lastCond = undefined;
            
            if(ass.length>1)
                if(ass[ass.length-1].op == 'JMP' || ass[ass.length-1].op == 'ifFalse' || ass[ass.length-1].op == 'ifTrue') {
                    lastJump = ass.pop();
                    if(ass.length>1 && ass[ass.length-1].w.v == '$cond')
                        lastCond = ass.pop();
                }
            
            n.parents[i].emit({ op: '=', w: {t:'VAR', v:phi.w}, r1: {t:'VAR', v:phi.r[i]} });
            if(lastCond) {
                ass.push(lastCond);
            }
            if(lastJump) {
                ass.push(lastJump);
            }
        }
    }
    delete n.phis;
    for(var i in n.children) {
        psiToIRTransform(n.children[i]);
    }
}

module.exports = psiToIRTransform;