'use strict';

function toStringIR(b) {
    const v = (x) => {
        // return JSON.stringify(x);
        const reg = x.reg ? ':'+x.reg:'';
        return (x.ssa?x.ssa:x.v)+reg;
    };
    const text = [];
    for (let ins of b.ilcode) {
        // text.push(JSON.stringify(ins));
        if (ins.op == '*') {
            text.push(`${v(ins.w)} := ${v(ins.r1)} * ${v(ins.r2)}`);
        } else if (ins.op == '+') {
            text.push(`${v(ins.w)} := ${v(ins.r1)} + ${v(ins.r2)}`);
        } else if (ins.op == '-') {
            text.push(`${v(ins.w)} := ${v(ins.r1)} - ${v(ins.r2)}`);
        } else if (ins.op == '=') {
            text.push(`${v(ins.w)} := ${v(ins.r1)}`);
        } else if (ins.op == 'GET_POINTER') {
            text.push(`${v(ins.w)} := getPtr(${v(ins.r1)})`);
        } else if (ins.op == '==') {
            text.push(`${v(ins.w)} := ${v(ins.r1)} == ${v(ins.r2)}`);
        } else if (ins.op == '!=') {
            text.push(`${v(ins.w)} := ${v(ins.r1)} != ${v(ins.r2)}`);
        } else if (ins.op == 'push') {
            text.push(`push ${v(ins.r1)}`);
        } else if (ins.op == 'pop') {
            text.push(`pop ${v(ins.w)}`);
        } else if (ins.op == 'jmp') {
            text.push(`jmp ${ins.label}`);
        } else if (ins.op == 'ifTrue') {
            text.push(`ifTrue ${v(ins.r1)}, ${ins.label}`);
        } else if (ins.op == 'ifFalse') {
            text.push(`ifFalse ${v(ins.r1)}, ${ins.label}`);
        } else if (ins.op == 'return') {
            text.push('return');
        } else if (ins.op == 'call') {
            text.push(`call ${ins.name}`);
        } else if (ins.op == 'functionStart') {
            text.push(`function ${ins.name}(${Object.keys(ins.args).join(',')})`);
            // console.log('SUB ESP, 12');
        } else if (ins.op == 'functionEnd') {
            text.push('functionEnd');
        } else if (ins.op == 'load') {
            text.push(`${v(ins.w)} = load ${v(ins.r1)}`);
        } else if (ins.op == 'store') {
            text.push(`store ${v(ins.r1)}, ${v(ins.r2)}`);
        } else {
            text.push(JSON.stringify(ins));
        }
    }
    return text;
}

function printIR(b) {
    let f = function() {
        if (b.visited == f) return;
        b.visited = f;
        console.log(`${b.name}:`);
        for (const j in b.phis) {
            const phi = b.phis[j];
            console.log(phi.w, ':=', 'psi(', phi.r.join(', '), ')');
        }
        if (b.ilcode.length > 0) console.log(toStringIR(b).join('\n'));

        for (const child of b.successors) {
            printIR(child);
        }
    };
    return f(b);
    // console.log("");
}

function toArray(b) {
    if (b.visited == toArray) return;
    b.visited = toArray;
    let results = [];
    results.push(`${b.name}:`);
    for (const j in b.phis) {
        const phi = b.phis[j];
        results.push(`${phi.w} := psi('${phi.r.join(', ')})`);
    }
    if (b.ilcode.length > 0) {
        Array.prototype.push.apply(results, toStringIR(b));
    }

    for (const child of b.successors) {
        Array.prototype.push.apply(results, toArray(child));
    }
    return results;
}

module.exports = { toStringIR, printIR, toArray };
