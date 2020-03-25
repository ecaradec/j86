var parser = require('./parser');
var ssaTransform = require('./ssaTransform');
var phiToIRTransform = require('./phiToIRTransform');
var registersTransform = require('./registerTransform')

//
// Print IR
//
console.log("* IR");
var program = [
    "FUNCTION test() {",
    "a = 1;",
    "b = 1;",
    "RETURN b;",
    "}",
    "FUNCTION main() {",
    "b = 1;",
    "a = b;",
    "c = b;",
    "RETURN a;",
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
for(var i in blockList) {
    console.log(blockList[i].name+':')
    blockList[i].printAssembly();
}

