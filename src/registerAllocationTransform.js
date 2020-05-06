'use strict';
//
// This transformation assign a reduced number of registers and memory space
// to variables.
//
// Decompose the graph of variable relations on node at a time
// then build it back and add registers if possible and spill variable on stack
// when no register is available.
// It also has for effect that spill variables space are reused if they
// are not used anywhere else to reduce stack space reservation.
const vertices = {};
let callClobbered = {};

function addVertex(n) {
    if (vertices[n] != undefined) return;
    vertices[n] = {
        connections: []
    };
}

function addEdge(a, b) {
    if (vertices[a].connections.indexOf(b) == -1) vertices[a].connections.push(b);
    if (vertices[b].connections.indexOf(a) == -1) vertices[b].connections.push(a);
}

function findLowestConnectedVertex() {
    let lowestConnectionNb = 1000000;
    let lowestConnectedNode;

    for (const i in vertices) {
        if (vertices[i].connections.length < lowestConnectionNb) {
            lowestConnectionNb = vertices[i].connections.length;
            lowestConnectedNode = i;
        }
    }
    return lowestConnectedNode;
}

function dropVertex(n) {
    const cloned = {
        id: n,
        connections: [...vertices[n].connections]
    };

    for (const i in vertices[n].connections) {
        const nn = vertices[n].connections[i];

        const pos = vertices[nn].connections.indexOf(n);
        if (pos != -1) vertices[nn].connections.splice(pos, 1);
    }
    delete vertices[n];

    return cloned;
}

let spillReg = 0;
function getRegister(a, spillRegisters) {
    for(let i in a) {
        return a[i];
    }
    for(let i in spillRegisters) {
        return spillRegisters[i];
    }
    spillRegisters[`s${spillReg}`] = {
        t: 'VAR',
        v: `s${spillReg}`,
    };
    spillReg++;
    return spillRegisters[`s${spillReg-1}`];
}

// Return a variable to register or variable to spill variable using graph coloring
function findRegisterMapping() {
    const d = findLowestConnectedVertex();
    if (d == undefined) return;

    const dropped = dropVertex(d);

    findRegisterMapping();

    // build back graph and delete used registers
    addVertex(dropped.id);
    // EAX is always used as a temporary and possibly (not yet)
    // as a return value, so it's not suitable to storage of variables
    let callPreservedRegisters = {
        ebx: {
            t: 'REG',
            v: 'ebx',
        },
        esi: {
            t: 'REG',
            v: 'esi',
        },
        edi: {
            t: 'REG',
            v: 'edi',
        },
    };

    let callCloberredRegisters = {
        ecx: {
            t: 'REG',
            v: 'ecx',
        },
        edx: {
            t: 'REG',
            v: 'edx',
        },
    };

    let spillRegisters = {};

    for (let i in dropped.connections) {
        const n = dropped.connections[i];
        delete callPreservedRegisters[vertices[n].reg.v];
        delete callCloberredRegisters[vertices[n].reg.v];
        delete spillRegisters[vertices[n].reg.v];
        addEdge(dropped.id, n);
    }

    // assign register if one left, or spill variable
    if( callClobbered[dropped.id] )
        vertices[dropped.id].reg = getRegister(callPreservedRegisters, spillRegisters);
    else
        vertices[dropped.id].reg = getRegister(callCloberredRegisters, spillRegisters);

    const registers = {};
    for (let i in vertices) {
        registers[i] = vertices[i].reg;
    }
    return registers;
}

function addFullyLinkedVertices(keys) {
    for (let ii = 0; ii < keys.length; ii++) {
        addVertex(keys[ii]);
    }
    for (let ii = 0; ii < keys.length; ii++) {
        for (let jj = 0; jj < keys.length; jj++) {
            if (ii != jj) addEdge(keys[ii], keys[jj]);
        }
    }
}

function isRegister(v) {
    return v && v.t == 'VREG';
}

// Build a graph representing variable used at the same time
// 
// Parse the code backward, add vertex for each variable when the variable is read,
// remove the vertex when the variable is written. This allows to build the range
// where the variable is live
function buildLiveRegisterGraph(nodes) {
    for(let ib in nodes) {
        let n = nodes[ib];

        let liveRegisters = {};
        for (let s of n.successors) {
            liveRegisters = {
                ...liveRegisters, ...s.liveRegisters
            };
        }

        // Propagate read variables for backward
        // When a variable is read, it's added to the list of active variables
        // When a variable is written, it is removed from the list of active variable
        for (let i = n.ilcode.length - 1; i >= 0; i--) {
            const ins = n.ilcode[i];
            if (ins == undefined) {
                continue;
            }

            //
            // During and after instruction
            //
            // Ensure a variable is available to write
            if (isRegister(ins.w)) {
                liveRegisters[ins.w.ssa] = true;
            }

            // can't assign call-cloberred register to some variables
            if(ins.op == 'call') {
                for(let ir in liveRegisters) {
                    callClobbered[ir] = true;
                }
            }

            addFullyLinkedVertices(Object.keys(liveRegisters));

            //
            // before instruction
            //
            // Propagate read variables backwards / Delete written variable
            if (isRegister(ins.w)) {
                delete liveRegisters[ins.w.ssa];
            }

            for(let ir in ins.r) {
                let r = ins.r[ir];
                if (isRegister(r)) {
                    liveRegisters[r.ssa] = true;
                }
            }

            // can't assign call-cloberred register to some variables
            if(ins.op == 'call') {
                for(let ir in liveRegisters) {
                    callClobbered[ir] = true;
                }
            }

            addFullyLinkedVertices(Object.keys(liveRegisters));
        }

        n.liveRegisters = liveRegisters;
    }
}

function replaceRegisters(nodes, registers) {
    
    for(let ib in nodes) {
        let n = nodes[ib];

        let ilcode = [];
        for (let ii = 0; ii < n.ilcode.length; ii++) {
            const ins = n.ilcode[ii];

            for(let ir in ins.r) {
                if (isRegister(ins.r[ir])) {
                    ins.r[ir].t = registers[ins.r[ir].ssa].t;
                    ins.r[ir].reg = registers[ins.r[ir].ssa].v;
                }    
                if(n.func && ins.r[ir].t == 'REG')
                    n.func.usedRegisters[ins.r[ir].reg] = true;
            }

            if (isRegister(ins.w)) {
                ins.w.t = registers[ins.w.ssa].t;
                ins.w.reg = registers[ins.w.ssa].v;
                if(n.func && ins.w.t == 'REG')
                    n.func.usedRegisters[ins.w.reg] = true;
            }

            // drop instructions that move register to iself
            // if (ins.op == '=' && ins.w != undefined && ins.w.reg == ins.r1.reg && ins.r2 == undefined) {
            //     continue;
            //}
            ilcode.push(ins);
        }
        n.ilcode = ilcode;
    }
}

module.exports = function (f) {
    buildLiveRegisterGraph([...f.dominanceOrderList].reverse());
    const mapping = findRegisterMapping();
    replaceRegisters(f.dominanceOrderList, mapping);
};
