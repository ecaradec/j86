function toStringIR(b) {
    var text = [];
    for (var i = 0; i < b.assembly.length; i++) {
        var ins = b.assembly[i];
        //text.push(JSON.stringify(ins));
        if (ins.op == '*') {
            text.push(ins.w.v + ' := ' + ins.r1.v + ' * ' + ins.r2.v);
        } else if (ins.op == '+') {
            text.push(ins.w.v + ' := ' + ins.r1.v + ' + ' + ins.r2.v);
        } else if (ins.op == '-') {
            text.push(ins.w.v + ' := ' + ins.r1.v + ' - ' + ins.r2.v);
        } else if (ins.op == '=') {
            text.push(ins.w.v + ' := ' + ins.r1.v);
        } else if (ins.op == '==') {
            text.push(ins.w.v + ' := ' + ins.r1.v + ' == ' + ins.r2.v);
        } else if (ins.op == '!=') {
            text.push(ins.w.v + ' := ' + ins.r1.v + ' != ' + ins.r2.v);
        } else if (ins.op == 'PUSH') {
            text.push('push ' + ins.r1.v);
        } else if (ins.op == 'POP') {
            text.push('pop ' + ins.w.v);
        } else if (ins.op == 'jmp') {
            text.push('jmp ' + ins.label);
        } else if (ins.op == 'ifTrue') {
            text.push('ifTrue ' + ins.r1.v + ', ' + ins.label);
        } else if (ins.op == 'ifFalse') {
            text.push('ifFalse ' + ins.r1.v + ', ' + ins.label);
        } else if (ins.op == 'return') {
            text.push('return ' + ins.r1.v);
        } else if (ins.op == 'call') {
            text.push('call ' + ins.name);
        } else if (ins.op == 'functionStart') {
            text.push('function ' + ins.name);
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
    console.log(b.name + ':');
    for (var j in b.phis) {
        var phi = b.phis[j];
        console.log(phi.w, ':=', 'psi(', phi.r.join(', '), ')');
    }
    if (b.assembly.length > 0) console.log(toStringIR(b).join('\n'));

    for (var i in b.children) {
        printIR(b.children[i]);
    }
    // console.log("");
}

module.exports = printIR;
