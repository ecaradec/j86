function printAssembly(b) {
    function getLastIns(n) {
        if (n.assembly.length > 0) return n.assembly[n.assembly.length - 1];
        return getLastIns(n.parents[0]);
    }

    function getPrevIns(n) {
        if (n.assembly.length > 1) return n.assembly[i - 1];
        // should really check on all path, but it's enough for now
        // as the function is only used to prevent double return.
        // it can still happens if doing return on booth path of an if/else
        return getLastIns(n.parents[0]);
    }

    function printIns() {
        arguments[0] = `    ${arguments[0]}`;
        console.log.apply({}, arguments);
    }
    for (var i = 0; i < b.assembly.length; i++) {
        const ins = b.assembly[i];

        let trueCond, falseCond;

        if (ins.op == '*') {
            printIns(`mov eax, ${ins.r1.v}`);
            printIns(`mul eax, ${ins.r2.v}`);
            printIns(`mov ${ins.w.v}, eax`);
        } else if (ins.op == '+') {
            printIns(`mov eax, ${ins.r1.v}`);
            printIns(`add eax, ${ins.r2.v}`);
            printIns(`mov ${ins.w.v}, eax`);
        } else if (ins.op == '-') {
            printIns(`mov eax, ${ins.r1.v}`);
            printIns(`sub eax, ${ins.r2.v}`);
            printIns(`mov ${ins.w.v}, eax`);
        } else if (ins.op == '=') {
            if (ins.w.v != ins.r1.v) {
                // should really be done on IR
                if (
                    (ins.w.t == 'VAR' || ins.w.t == 'STACKVAR') &&
                    (ins.r1.t == 'VAR' || ins.r1.t == 'STACKVAR')
                ) {
                    printIns(`mov eax, ${ins.r1.v}`);
                    printIns(`mov ${ins.w.v}, eax`);
                } else {
                    printIns(`mov ${ins.w.v}, ${ins.r1.v}`);
                }
            }
        } else if (ins.op == '==') {
            printIns(`cmp ${ins.r1.v}, ${ins.r2.v}`);
            trueCond = 'e';
            falseCond = 'ne';
        } else if (ins.op == '!=') {
            printIns(`cmp ${ins.r1.v}, ${ins.r2.v}`);
            trueCond = 'ne';
            falseCond = 'e';
        } else if (ins.op === 'ifTrue') {
            printIns(`j${trueCond} ${ins.label}`);
        } else if (ins.op == 'ifFalse') {
            printIns(`j${falseCond} ${ins.label}`);
        } else if (ins.op == 'push') {
            printIns(`push ${ins.r1.v}`);
        } else if (ins.op == 'pop') {
            printIns(`pop ${ins.w.v}`);
        } else if (ins.op == 'jmp') {
            printIns(`jmp ${ins.label}`);
        } else if (ins.op == 'call') {
            printIns(`call ${ins.name}`);
        } else if (ins.op == 'functionStart') {
            console.log(`${ins.name}:`);
            printIns('push ebp');
            printIns('mov ebp, esp');
            printIns(`sub esp, ${4 * ins.varCount}`);
            var registers = Object.keys(ins.usedRegisters);
            for (const j in registers) {
                printIns('push', registers[j]);
            }
        } else if (ins.op === 'functionEnd') {
            if (getPrevIns(b).op != 'return') {
                // don't add ret if previous ins was return
                let registers = Object.keys(b.func.usedRegisters).reverse();
                for (var r in registers) {
                    printIns('pop', registers[r]);
                }
                printIns('leave');
                printIns('ret', b.func.argCount * 4);
            }
        } else if (ins.op == 'return') {
            printIns(`mov eax, ${ins.r1.v}`);
            let registers = Object.keys(b.func.usedRegisters).reverse();
            for (let r in registers) {
                printIns('pop', registers[r]);
            }
            printIns('leave');
            printIns('ret', b.func.argCount * 4);
        } else {
            printIns(JSON.stringify(ins));
        }
    }
}

function printAssemblyRec(b) {
    if (b.visited == printAssemblyRec) return;
    b.visited = printAssemblyRec;
    console.log(`${b.name}:`);
    printAssembly(b);
    for (const i in b.children) {
        printAssemblyRec(b.children[i]);
    }
}
module.exports = printAssemblyRec;
