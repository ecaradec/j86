// const expect = require('expect');
const parser = require('../parser.js');
const { toArray } = require('../printIR');

describe('Parser', () => {
    it('parse a main function', () => {
        const program = `
FUNCTION main() {}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'functionEnd'
        ]);
    });

    it('parse an assignment', () => {
        const program = `
FUNCTION main() { a = 1; }
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'a := 1',
            'functionEnd'
        ]);
    });

    it('parse a product', () => {
        const program = `
FUNCTION main() {
a = 1 * 2;
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'tmp0 := 1 * 2',
            'a := tmp0',
            'functionEnd'
        ]);
    });

    it('parse a sum', () => {
        const program = `
FUNCTION main() {
a = 1 + 2;
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'tmp0 := 1 + 2',
            'a := tmp0',
            'functionEnd'
        ]);
    });

    it('parse operator with precedence', () => {
        const program = `
FUNCTION main() {
a = 1 * 2 + 3 * 4;
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'tmp0 := 1 * 2',
            'tmp1 := 3 * 4',
            'tmp2 := tmp0 + tmp1',
            'a := tmp2',
            'functionEnd'
        ]);
    });

    it('parse a while', () => {
        const program = `
FUNCTION main() {
a = 10;
WHILE(a != 0) {
a = a + 1;
}
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'a := 10',
            'block_2:',
            '$cond := a != 0',
            'ifFalse $cond, block_3',
            'tmp0 := a + 1',
            'a := tmp0',
            'jmp block_2',
            'block_3:',
            'functionEnd'
        ]);
    });

    it('parse an if statement', () => {
        const program = `
FUNCTION main() {
a = 1;
IF( a == 1 ) {
a = 1;
} ELSE {
a = 2;
}
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function main',
            'a := 1',
            '$cond := a == 1',
            'ifFalse $cond, block_2',
            'a := 1',
            'jmp block_3',
            'block_2:',
            'a := 2',
            'block_3:',
            'functionEnd'
        ]);
    });


    it('parse a function call', () => {
        const program = `
FUNCTION test(a,b) {
}
FUNCTION main() {
test(1,2);
}
`;
        parser.build(program);
        expect(toArray(parser.getAST())).toStrictEqual([
            'block_0:',
            'block_1:',
            'function test',
            'functionEnd',
            'block_2:',
            'function main',
            'push 1',
            'push 2',
            'call test',
            'functionEnd'
        ]);
    });
});
