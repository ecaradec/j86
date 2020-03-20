var parser = require('./parser');
var ssaTransform = require('./ssaTransform');
var psiToIRTransform = require('./psiToIRTransform');
var registersTransform = require('./registerTransform')

//
// Print IR
//
console.log("\n* IR");
var program = [
    "FUNCTION main() {",
    //"a = 1*2+3*4+5*6;",
    //"IF(1*1) { a = 1; }",
    //"b = 1;",
    //"IF(b == 1) { a = 2; }",
    // "a = 10;",
    "a = 1;",
    "b = 2;",
    "c = 3;",
    //"d = a+b+c;",
    //"a = d;",
    //"c = b;",
    //"a = 1;",
    "WHILE( a == 10 ) { a = a + 1; }",
    "IF(b == 1) { a = 2; }",
    //"WHILE(c) { c = c - 1; }",
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
ssaTransform(block, undefined, {});
parser.printIR();

//
// Print PSI RESOLVED SSA IR
//
console.log("* PSIRESOLVED-SSA-IR");
psiToIRTransform(block);
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
console.log("\n* Assembly");
for(var i in blockList) {
    console.log(blockList[i].name+':')
    blockList[i].printAssembly();
}

