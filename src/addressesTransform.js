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

            for(let ir in ins.r) {
                if(ins.r[ir] && ins.r[ir].t == 'VAR') {
                    ins.r[ir].address = getVarAddress(ins.r[ir].v);
                }    
            }

            if(ins.w && ins.w.t == 'VAR') {
                ins.w.address = getVarAddress(ins.w.v);
            }
        }
    }
}

module.exports = (f)=> addressesTransform(f.dominanceOrderList);