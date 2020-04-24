'use strict';

function printAssembly(b) {
    function getLastIns(n) {
        if (n.ilcode.length > 0) return n.ilcode[n.ilcode.length - 1];
        return getLastIns(n.predecessors[0]);
    }

    function getPrevIns(n) {
        if (n.ilcode.length > 1) return n.ilcode[n.ilcode.length - 1];
        // should really check on all path, but it's enough for now
        // as the function is only used to prevent double return.
        // it can still happens if doing return on booth path of an if/else
        return getLastIns(n.predecessors[0]);
    }

    function printIns() {
        arguments[0] = `    ${arguments[0]}`;
        console.log.apply({}, arguments);
    }

    const v = x => {
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

    let trueCond, falseCond;
    for (const ins of b.ilcode) {
        if (ins.op == '*') {
            if(ins.w.reg == 'eax') {
                printIns(`mov eax, ${v(ins.r1)}`);
                printIns(`mul ${v(ins.r2)}`);
            } else if(ins.r1.reg == 'eax') {
                printIns('push eax');
                printIns(`mul ${v(ins.r2)}`);
                printIns(`mov ${v(ins.w)}, eax`);
                printIns('pop eax');
            } else if(ins.r2.reg == 'eax') {
                printIns('push eax');
                printIns(`mul ${v(ins.r1)}`);
                printIns(`mov ${v(ins.w)}, eax`);
                printIns('pop eax');
            } else {
                printIns('push eax');
                printIns(`mov eax, ${v(ins.r1)}`);
                printIns(`mul ${v(ins.r2)}`);
                printIns(`mov ${v(ins.w)}, eax`);
                printIns('pop eax');
                // throw 'spill register with mul not implemented';
            }
        } else if (ins.op == '+') {
            printIns(`mov ${v(ins.w)}, ${v(ins.r1)}`);
            printIns(`add ${v(ins.w)}, ${v(ins.r2)}`);
        } else if (ins.op == '-') {
            printIns(`mov ${v(ins.w)}, ${v(ins.r1)}`);
            printIns(`sub ${v(ins.w)}, ${v(ins.r2)}`);
        } else if (ins.op == '=') {
            if (ins.w.v != ins.r1.v) {
                // if both variable are in memory, use eax to transfer
                if (ins.w.spill && ins.r1.spill) {
                    printIns('push eax');
                    printIns(`mov eax, ${v(ins.r1)}`);
                    printIns(`mov ${v(ins.w)}, eax`);
                    printIns('pop eax');
                } else {
                    printIns(`mov ${v(ins.w)}, ${v(ins.r1)}`);
                }
            }
        } else if(ins.op == 'ptrOf') {
            //console.log(JSON.stringify(ins));
            printIns(`lea ${v(ins.w)}, ${indirectLEA(ins.r1)}`);
        } else if(ins.op == 'load') {
            printIns(`mov ${v(ins.w)}, ${indirect(ins.r1)}`);
        } else if(ins.op == 'store') {
            printIns(`mov ${indirect(ins.r1)}, ${v(ins.r2)}`);
        } else if (ins.op == '==') {
            printIns(`cmp ${v(ins.r1)}, ${v(ins.r2)}`);
            trueCond = 'e';
            falseCond = 'ne';
        } else if (ins.op == '!=') {
            printIns(`cmp ${v(ins.r1)}, ${v(ins.r2)}`);
            trueCond = 'ne';
            falseCond = 'e';
        } else if (ins.op === 'ifTrue') {
            printIns(`j${trueCond} ${ins.label}`);
        } else if (ins.op == 'ifFalse') {
            printIns(`j${falseCond} ${ins.label}`);
        } else if (ins.op == 'push') {
            printIns(`push ${v(ins.r1)}`);
        } else if (ins.op == 'pop') {
            printIns(`pop ${v(ins.w)}`);
        } else if (ins.op == 'jmp') {
            printIns(`jmp ${ins.label}`);
        } else if (ins.op == 'call') {
            printIns(`call ${ins.name}`);
        } else if (ins.op == 'functionStart') {
            console.log(`${ins.name}:`);
            printIns('push ebp');
            printIns('mov ebp, esp');
            printIns(`sub esp, ${4 * b.func.varCount}`);
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
            // printIns(`mov eax, ${ins.r1.v}`);
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

module.exports = function (nodes, strings) {
    console.log('section .text');
    console.log('    global _start');

    for(let i in nodes) {
        let b = nodes[i];
        console.log(`${b.name}:`);
        printAssembly(b);
    }

    console.log(`
_start:
    call main
    mov eax, 1
    mov ebx, 0
    int 0x80

strlen:
    push ebp
    mov ebp, esp
    push ebx
    push ecx
    push edx
    
    mov edi, [ebp+8]
    sub ecx, ecx
    sub al, al
    not ecx
    cld
    repne scasb
    not ecx
    dec ecx
    mov eax, ecx
    
    pop edx
    pop ecx
    pop ebx
    pop ebp
    ret

print:
    push ebp
    mov ebp, esp
    push ebx
    push ecx
    push edx
    
    push dword [ebp+8]
    call strlen
    add esp, 4
    
    mov edx, eax
    mov ecx, dword [ebp+8]
    mov ebx, 1
    mov eax, 4
    int 0x80
    
    pop edx
    pop ecx
    pop ebx
    pop ebp
    ret

section .data`);

    for (let s in strings) {
        console.log(`    ${s} db	 '${strings[s]}', 0x0a, 0`);
    }
};
