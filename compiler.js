const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const printIR = require('./printIR');
const printAssembly = require('./printAssembly');

//
// Print IR
//
console.log('* IR');
var program = [
    // "FUNCTION test(a,b) {",
    // "a = a;",
    // "b = b;",
    // "c = 1;",
    // "d = 1;",
    // "e = 1;",
    // "f = a+b+c+d+e;",
    // "RETURN b;",
    // "}",
    'FUNCTION main() {',
    'a = 0;',
    'WHILE(a != 10) {',
    'ok();',
    'a = a + 1;',
    '}',
    // "b = 1;",
    // "a = 1;",
    // "WHILE(a == 10) { a = a + 1; }",
    // "IF(a == 1) { a = 2; } ELSE { a = 1;  }",
    // "IF(a == 1) { a = 2; }",
    // "WHILE(a == 10) { a = a + 1; }",
    // "IF(a == 1) { a = 2; } ELSE { a = 1;  }",
    // "IF(a == 1) { a = 2; }",
    // "a = b;",
    '}',
    '',
].join('\n');
program = parser.build(program);
printIR(program);

//
// Print SSA-IR
//
console.log('* SSA-IR');
ssaTransform(program);
printIR(program);
console.log('');

//
// Print PHI RESOLVED SSA IR
//
console.log('* PSIRESOLVED-SSA-IR');
phiToIRTransform(program);
printIR(program);
console.log('');

//
// IR WITH REGISTERS
//
console.log('* IR WITH REGISTERS');
registersTransform(program);
printIR(program);
console.log('');

//
// Print assembly
//
// EAX is only used for temporaries
console.log('* Assembly');
console.log('section .text');
console.log('    global _start');
printAssembly(program);
console.log('_start:');
console.log('    call main');
console.log('    mov eax, 1');
console.log('    int 0x80'); // sys_exit(1)
console.log();

// instrinsic function that print ok
console.log('ok:');
console.log('    push ebx');
console.log('    push ecx');
console.log('    push edx');
console.log('    mov edx, _oklen');
console.log('    mov ecx, _ok');
console.log('    mov ebx, 1');
console.log('    mov eax, 4');
console.log('    int 0x80');
console.log('    pop edx');
console.log('    pop ecx');
console.log('    pop ebx');
console.log('    ret');
console.log();

// instrinsic function that print nok
console.log('nok:');
console.log('    push ebx');
console.log('    push ecx');
console.log('    push edx');
console.log('    mov edx, _noklen');
console.log('    mov ecx, _nok');
console.log('    mov ebx, 1');
console.log('    mov eax, 4');
console.log('    int 0x80');
console.log('    pop edx');
console.log('    pop ecx');
console.log('    pop ebx');
console.log('    ret');
console.log();

console.log('section .data');
console.log('    _ok db	\'ok\',0xd, 0xa');
console.log('    _oklen equ 3');
console.log('    _nok db	\'nok\',0xd, 0xa');
console.log('    _noklen equ 4');
