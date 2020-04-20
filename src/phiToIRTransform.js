'use strict';
//
// Transform Phi function to IR
//
function phiToIRTransform(n) {
    if (n.visited == 'phi2ir') return;
    n.visited = 'phi2ir';

    const phis = n.getPHIs();
    for (const p in phis) {
        const phi = phis[p];

        // the first value in psi is the variable name to write
        // the remaining are the value to select
        // each value know in src, from which block it was know
        for (var i in phi.r) {
            const ass = n.predecessors[i].ilcode;
            let lastJump;
            let lastCond;

            if (ass.length > 1) {
                let lastOp = ass[ass.length - 1].op;
                if (
                    lastOp == 'jmp'
                ) {
                    lastJump = ass.pop();
                }
                if (
                    lastOp == 'ifFalse' ||
                    lastOp == 'ifTrue'
                ) {
                    lastJump = ass.pop();
                    lastCond = ass.pop();
                }
            }

            n.predecessors[i].emit({
                op: '=',
                w: phi.w,
                r1: phi.r[i],
            });
            if (lastCond) {
                ass.push(lastCond);
            }
            if (lastJump) {
                ass.push(lastJump);
            }
        }
    }
    while(n.ilcode.length > 0 && n.ilcode[0].op == 'phi') {
        n.ilcode.shift();
    }
    
    for (const child of n.successors) {
        phiToIRTransform(child);
    }
}

module.exports = phiToIRTransform;
