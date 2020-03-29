//
// Transform Psi function to IR
//
function psiToIRTransform(n) {
    if (n.visited == 'psi2ir') return;
    n.visited = 'psi2ir';

    for (const p in n.phis) {
        const phi = n.phis[p];

        // the first value in psi is the variable name to write
        // the remaining are the value to select
        // each value know in src, from which block it was know
        for (var i in phi.r) {
            const ass = n.predecessors[i].assembly;
            let lastJump;
            let lastCond;

            if (ass.length > 1) {
                if (
                    ass[ass.length - 1].op == 'JMP' ||
                    ass[ass.length - 1].op == 'ifFalse' ||
                    ass[ass.length - 1].op == 'ifTrue'
                ) {
                    lastJump = ass.pop();
                    if (ass.length > 1 && ass[ass.length - 1].w.v == '$cond') lastCond = ass.pop();
                }
            }

            n.predecessors[i].emit({
                op: '=',
                w: {
                    t: 'VAR',
                    v: phi.w
                },
                r1: {
                    t: 'VAR',
                    v: phi.r[i]
                },
            });
            if (lastCond) {
                ass.push(lastCond);
            }
            if (lastJump) {
                ass.push(lastJump);
            }
        }
    }
    delete n.phis;
    for (const child of n.successors) {
        psiToIRTransform(child);
    }
}

module.exports = psiToIRTransform;
