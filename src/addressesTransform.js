'use strict';


// Traverse the dominance tree, increasing variables index progressively
function addressesTransform(nodes) {
    let currentFunc;
    let ivar;
    let variables = {};

    function getVarAddress(n) {
        if(currentFunc.args[n])
            return currentFunc.args[n].address;
        if(variables[n])
            return variables[n];
        variables[n] = 'ebp-'+(4*ivar+4);
        ivar++;
        return variables[n];
    }
    for(let ib in nodes) {
        for(let ii in nodes[ib].ilcode) {
            let ins = nodes[ib].ilcode[ii];
            if(ins.op == 'functionStart') {
                currentFunc = ins;
                let i = 0;
                for(let iarg in currentFunc.args) {
                    currentFunc.args[iarg].address = 'ebp+'+(4*i+8);
                    i++;
                }
                ivar=0;
            }

            if(ins.r1 && ins.r1.t == 'VAR') {
                ins.r1.address = getVarAddress(ins.r1.v);
            }
            
            if(ins.r2 && ins.r2.t == 'VAR') {
                ins.r2.address = getVarAddress(ins.r2.v);
            }

            if(ins.w && ins.w.t == 'VAR') {
                ins.w.address = getVarAddress(ins.w.v);
            }
        }
    }
}

module.exports = addressesTransform;