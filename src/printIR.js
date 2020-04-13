'use strict';

function toStringIR(b) {
    const text = [];
    for (let ins of b.ilcode) {
        // text.push(JSON.stringify(ins));
        if (ins.op == '*') {
            text.push(`${ins.w.v} := ${ins.r1.v} * ${ins.r2.v}`);
        } else if (ins.op == '+') {
            text.push(`${ins.w.v} := ${ins.r1.v} + ${ins.r2.v}`);
        } else if (ins.op == '-') {
            text.push(`${ins.w.v} := ${ins.r1.v} - ${ins.r2.v}`);
        } else if (ins.op == '=') {
            text.push(`${ins.w.v} := ${ins.r1.v}`);
        } else if (ins.op == '==') {
            text.push(`${ins.w.v} := ${ins.r1.v} == ${ins.r2.v}`);
        } else if (ins.op == '!=') {
            text.push(`${ins.w.v} := ${ins.r1.v} != ${ins.r2.v}`);
        } else if (ins.op == 'push') {
            text.push(`push ${ins.r1.v}`);
        } else if (ins.op == 'pop') {
            text.push(`pop ${ins.w.v}`);
        } else if (ins.op == 'jmp') {
            text.push(`jmp ${ins.label}`);
        } else if (ins.op == 'ifTrue') {
            text.push(`ifTrue ${ins.r1.v}, ${ins.label}`);
        } else if (ins.op == 'ifFalse') {
            text.push(`ifFalse ${ins.r1.v}, ${ins.label}`);
        } else if (ins.op == 'return') {
            text.push(`return ${ins.r1.v}`);
        } else if (ins.op == 'call') {
            text.push(`call ${ins.name}`);
        } else if (ins.op == 'functionStart') {
            text.push(`function ${ins.name}`);
            // console.log('SUB ESP, 12');
        } else if (ins.op == 'functionEnd') {
            text.push('functionEnd');
        } else {
            text.push(JSON.stringify(ins));
        }
    }
    return text;
}

function printIR(b) {
    if (b.visited == printIR) return;
    b.visited = printIR;
    console.log(`${b.name}:`);
    for (const j in b.phis) {
        const phi = b.phis[j];
        console.log(phi.w, ':=', 'psi(', phi.r.join(', '), ')');
    }
    if (b.ilcode.length > 0) console.log(toStringIR(b).join('\n'));

    for (const child of b.successors) {
        printIR(child);
    }
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