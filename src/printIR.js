'use strict';

function toStringIR(b) {
    const v = (x) => {
        // return JSON.stringify(x);
        const reg = x.reg ? ':'+x.reg:'';
        //const address = x.address ? ':['+x.address+']':'';
        return (x.ssa?x.ssa:x.v)+reg;//+address;
    };
    const text = [];
    for (let ins of b.ilcode) {
        //console.log(JSON.stringify(ins));
        // text.push(JSON.stringify(ins));
        if (ins.op == '*') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])} * ${v(ins.r[1])}`);
        } else if (ins.op == '+') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])} + ${v(ins.r[1])}`);
        } else if (ins.op == '-') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])} - ${v(ins.r[1])}`);
        } else if (ins.op == '=') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])}`);
        } else if (ins.op == 'ptrOf') {
            text.push(`${v(ins.w)} := ptrOf ${v(ins.r[0])}`);
        } else if (ins.op == '==') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])} == ${v(ins.r[1])}`);
        } else if (ins.op == '!=') {
            text.push(`${v(ins.w)} := ${v(ins.r[0])} != ${v(ins.r[1])}`);
        } else if (ins.op == 'push') {
            text.push(`push ${v(ins.r[0])}`);
        } else if (ins.op == 'pop') {
            text.push(`pop ${v(ins.w)}`);
        } else if (ins.op == 'jmp') {
            text.push(`jmp ${ins.label}`);
        } else if (ins.op == 'ifTrue') {
            text.push(`ifTrue ${v(ins.r[0])}, ${ins.label}`);
        } else if (ins.op == 'ifFalse') {
            text.push(`ifFalse ${v(ins.r[0])}, ${ins.label}`);
        } else if (ins.op == 'return') {
            text.push(`return ${v(ins.r[0])}`);
        } else if (ins.op == 'call') {
            if(ins.w.type == 'VOID')
                text.push(`call ${ins.name}(${ins.r.map(x=>x.v).join(', ')})`);
            else
                text.push(`${v(ins.w)} = call ${ins.name}(${ins.r.map(x=>x.v).join(', ')})`);
        } else if (ins.op == 'functionStart') {
            text.push(`function ${ins.name}(${Object.keys(ins.args).join(',')})`);
            // console.log('SUB ESP, 12');
        } else if (ins.op == 'functionEnd') {
            text.push('functionEnd');
        } else if (ins.op == 'load') {
            text.push(`${v(ins.w)} = load ${v(ins.r[0])}`);
        } else if (ins.op == 'store') {
            text.push(`store ${v(ins.r[0])}, ${v(ins.r[1])}`);
        } else if (ins.op == 'phi') {
            // console.log(JSON.stringify(ins));
            text.push(`${ins.w.ssa?ins.w.ssa:ins.w.v} := phi ${ins.id} [ ${ins.r.map(x=>x.ssa?x.ssa:x.v).join(', ')} ]`);
        } else {
            text.push(JSON.stringify(ins));
        }
    }
    return text;
}

function printIR(nodes) {
    for(let i in nodes) {
        let b = nodes[i];
        console.log(`${b.name}:`);
        if (b.ilcode.length > 0)
            console.log(toStringIR(b).join('\n'));
    }
    console.log('');
}

function toArray(b) {
    if (b.visited == toArray) return;
    b.visited = toArray;
    let results = [];
    results.push(`${b.name}:`);
    if (b.ilcode.length > 0) {
        Array.prototype.push.apply(results, toStringIR(b));
    }

    for (const child of b.successors) {
        Array.prototype.push.apply(results, toArray(child));
    }
    return results;
}

module.exports = { toStringIR, printIR, toArray };
