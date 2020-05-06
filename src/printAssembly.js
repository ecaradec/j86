'use strict';

function printAssembly(nodes) {
    function printIns() {
        arguments[0] = `    ${arguments[0]}`;
        console.log.apply({}, arguments);
    }

    const v = x => {
        if(x.t == 'VAR')
            return `dword [${x.address}]`;

        //return JSON.stringify(x);
        //return x.v;
        if(x.reg) {
            return `${x.reg}`;
            //return x.reg; //+':'+x.v;
        }
        return x.v;
    };

    const indirect = x => {
        //return JSON.stringify(x);
        if(x.reg) {
            return `dword [${x.reg}]`;
        }
        return `dword [${x.address}]`;
        //return `dword ptr [${x.address}]`;
    };

    const indirectLEA = x => {
        //return JSON.stringify(x);
        if(x.reg) {
            return `[${x.reg}]`;
        }
        return `[${x.address}]`;
        //return `dword ptr [${x.address}]`;
    };

    for(let i in nodes) {
        let b = nodes[i];
        console.log(`${b.name}:`);

        let trueCond, falseCond;
        for (const ins of b.ilcode) {
            if (ins.op == '*') {
                printIns(`mov eax, ${v(ins.r[0])}`);
                printIns(`mul ${v(ins.r[1])}`);
                printIns(`mov ${v(ins.w)}, eax`);
            } else if (ins.op == '+') {
                printIns(`mov eax, ${v(ins.r[0])}`);
                printIns(`add eax, ${v(ins.r[1])}`);
                printIns(`mov ${v(ins.w)}, eax`);
            } else if (ins.op == '-') {
                printIns(`mov eax, ${v(ins.r[0])}`);
                printIns(`sub eax, ${v(ins.r[1])}`);
                printIns(`mov ${v(ins.w)}, eax`);
            } else if (ins.op == '=') {
                if (ins.w.v != ins.r[0].v) {
                    // if both variable are in memory, use eax to transfer
                    if (ins.w.t == 'VAR' && ins.r[0].t == 'VAR') {
                        printIns(`mov eax, ${v(ins.r[0])}`);
                        printIns(`mov ${v(ins.w)}, eax`);
                    } else {
                        printIns(`mov ${v(ins.w)}, ${v(ins.r[0])}`);
                    }
                }
            } else if(ins.op == 'ptrOf') {
                //console.log(JSON.stringify(ins));
                printIns(`lea ${v(ins.w)}, ${indirectLEA(ins.r[0])}`);
            } else if(ins.op == 'load') {
                printIns(`mov ${v(ins.w)}, ${indirect(ins.r[0])}`);
            } else if(ins.op == 'store') {
                printIns(`mov ${indirect(ins.r[0])}, ${v(ins.r[1])}`);
            } else if (ins.op == '==') {
                if(ins.r[0].t == 'DIGIT' && ins.r[1].t == 'DIGIT') { 
                    printIns(`mov eax, ${v(ins.r[0])}`);
                    ins.r[0] = {t: 'REG', reg: 'eax'};
                }
                printIns(`cmp ${v(ins.r[0])}, ${v(ins.r[1])}`);
                trueCond = 'e';
                falseCond = 'ne';
            } else if (ins.op == '!=') {
                if(ins.r[0].t == 'DIGIT' && ins.r[1].t == 'DIGIT') { 
                    printIns(`mov eax, ${v(ins.r[0])}`);
                    ins.r[0] = {t: 'REG', v: 'eax'};
                }
                printIns(`cmp ${v(ins.r[0])}, ${v(ins.r[1])}`);
                trueCond = 'ne';
                falseCond = 'e';
            } else if (ins.op === 'ifTrue') {
                printIns(`j${trueCond} ${ins.label}`);
            } else if (ins.op == 'ifFalse') {
                printIns(`j${falseCond} ${ins.label}`);
            } else if (ins.op == 'push') {
                printIns(`push ${v(ins.r[0])}`);
            } else if (ins.op == 'pop') {
                printIns(`pop ${v(ins.w)}`);
            } else if (ins.op == 'jmp') {
                printIns(`jmp ${ins.label}`);
            } else if (ins.op == 'call') {
                printIns(`call ${ins.name}`);
                printIns(`add esp, ${Object.keys(ins.func.args).length * 4}`);
                printIns(`mov ${v(ins.w)}, eax`);
            } else if (ins.op == 'functionStart') {
                console.log(`${ins.name}:`);
                printIns('push ebp');
                printIns('mov ebp, esp');
                printIns(`sub esp, ${4 * Object.keys(b.func.variables).length}`);
                var registers = Object.keys(ins.usedRegisters);
                for (const j in registers) {
                    printIns('push', registers[j]);
                }
            } else if (ins.op === 'functionEnd') {
                if(b.hasReturn) 
                    continue;

                // don't add ret if previous ins was return
                let registers = Object.keys(b.func.usedRegisters).reverse();
                for (var r in registers) {
                    printIns('pop', registers[r]);
                }
                printIns('leave');
                printIns('ret'); //, Object.keys(b.func.args).length * 4);
            } else if (ins.op == 'return') {
                if(ins.r[0])
                    printIns(`mov eax, ${v(ins.r[0])}`);
                let registers = Object.keys(b.func.usedRegisters).reverse();
                for (let r in registers) {
                    printIns('pop', registers[r]);
                }
                printIns('leave');
                printIns('ret'); //, Object.keys(b.func.args).length * 4);
            } else {
                printIns(JSON.stringify(ins));
            }
        }
    }
}

module.exports = function (nodes, strings) {
    console.log(`
extern exit, printf, malloc, free
`);
    console.log('section .text');
    console.log('    global main');

    printAssembly(nodes);

    console.log(`
section .data`);

    for (let s in strings) {
        console.log(`    ${s} db	 '${strings[s]}', 0x0a, 0`);
    }
};
