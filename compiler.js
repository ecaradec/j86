var parser = require('./parser');
var ssaTransform = require('./ssaTransform');
var phiToIRTransform = require('./phiToIRTransform');
var registersTransform = require('./registerTransform')

//
// Print IR
//
console.log("* IR");
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
    "FUNCTION main() {",
    "a = 0;",
    "b = 0;",
    "IF( a == 1 ) {",
    "CALL ok();",
    "} ELSE {",
    "CALL nok();",
    "}",
    //"b = 1;",
    //"a = 1;",
    //"WHILE(a == 10) { a = a + 1; }",
    //"IF(a == 1) { a = 2; } ELSE { a = 1;  }",
    //"IF(a == 1) { a = 2; }",
    //"WHILE(a == 10) { a = a + 1; }",
    //"IF(a == 1) { a = 2; } ELSE { a = 1;  }",
    //"IF(a == 1) { a = 2; }",
    //"a = b;",
    "}",
    ""
].join("\n");
var blockList = parser.build(program);
var block = blockList[0];
parser.printIR();

//
// Print SSA-IR
//
console.log("* SSA-IR");
ssaTransform(block, block, {}, {});
parser.printIR();

//
// Print PHI RESOLVED SSA IR
//
console.log("* PSIRESOLVED-SSA-IR");
phiToIRTransform(block);
parser.printIR();

//
// IR WITH REGISTERS
//
console.log("* IR WITH REGISTERS")
registersTransform(block);
parser.printIR();

//
// Print assembly
//
// EAX is only used for temporaries
console.log("* Assembly");
console.log("section .text");
console.log("    global _start");
for(var i in blockList) {
    console.log(blockList[i].name+':')
    blockList[i].printAssembly();
}
console.log("_start:");
console.log("    call main");
console.log("    mov eax, 1");
console.log("    int 0x80"); // sys_exit(1)
console.log();

// instrinsic function that print ok
console.log("ok:");
console.log("    push ebx");
console.log("    push ecx");
console.log("    push edx");
console.log("    mov edx, _oklen")
console.log("    mov ecx, _ok")
console.log("    mov ebx, 1")
console.log("    mov eax, 4")
console.log("    int 0x80");
console.log("    pop edx");
console.log("    pop ecx");
console.log("    pop ebx");
console.log("    ret");
console.log();

// instrinsic function that print nok
console.log("nok:");
console.log("    push ebx");
console.log("    push ecx");
console.log("    push edx");
console.log("    mov edx, _noklen")
console.log("    mov ecx, _nok")
console.log("    mov ebx, 1")
console.log("    mov eax, 4")
console.log("    int 0x80");
console.log("    pop edx");
console.log("    pop ecx");
console.log("    pop ebx");
console.log("    ret");
console.log();

console.log("section .data");
console.log("    _ok db	'ok',0xa");
console.log("    _oklen equ 2");
console.log("    _nok db	'nok',0xa");
console.log("    _noklen equ 3");
