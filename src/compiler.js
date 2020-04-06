'use strict';

const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');

/*let program = [
    "FUNCTION main() {",
    "a = a;",
    "b = b;",
    "c = 1;",
    "d = 1;",
    "e = 1;",
    "f = a+b+c+d+e;",
    "RETURN b;",
    "}",
]*/

/*let program = [
    'FUNCTION main() {',
    'a = 1;',
    'IF(a == 1) { a = 2; } ELSE { a = 1;  }',
    'b = a;',
    '}',
].join('\n');*/

/*let program = [
    'FUNCTION main() {',
    'a = 0;',
    'WHILE(a != 10) {',
    'ok();',
    'a = a + 1;',
    '}',
    '}',
    '',
].join('\n');*/

let program = `
FUNCTION main() {
    a = 1;
    IF( a == 1 ) {
    str = "Hello";
    } ELSE {
    str = "World";
    }
    print(str);
}
`;

console.log('* PROGRAM');
console.log(program);

//
// Print IR
//
console.log('* IR');
parser.build(program);
printIR(parser.getAST());
console.log('');

//
// Print SSA-IR
//
console.log('* SSA-IR');
ssaTransform(parser.getAST());
printIR(parser.getAST());
console.log('');

//
// Print PHI RESOLVED SSA IR
//
console.log('* PSIRESOLVED-SSA-IR');
phiToIRTransform(parser.getAST());
printIR(parser.getAST());
console.log('');

//
// IR WITH REGISTERS
//
console.log('* IR WITH REGISTERS');
registersTransform(parser.getAST());
printIR(parser.getAST());
console.log('');

//
// Print assembly
//
// EAX is only used for temporaries
console.log('* Assembly');
printAssembly(parser.getAST(), parser.getStrings());
console.log('');
