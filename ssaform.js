var index = 0;
function Node(name, parents, ins) {
    this.name = name;
    this.children = [];
    this.parents = [];
    this.ins = ins;
    this.psi = {};
    for(var i in parents) {
        parents[i].children.push(this);
        this.parents.push(i);
    }
    this.addParent = (p) => {
        this.parents.push(p);
        p.children.push(this);
    }
}

let n1 = new Node("n1", [], [{w:'a', r1: {t:'DIGIT', v:'1'}, r2: {t:'DIGIT', v:'1'}}, {w:'b', r1: {t:'VAR', v:'a'}}]);
let n2 = new Node("n2", [n1], [{w:'a', r1: {t:'DIGIT', v:'1'}, r2: {t:'VAR', v:'b'}} ]);
let n3 = new Node("n3", [n1], [{w:'a', r1: {t:'VAR', v:'a'}, r2: {t:'DIGIT', v:'1'}}]);
let n4 = new Node("n4", [n2,n3], [{w:'a', r1: {t:'VAR', v:'a'}, r2: {t:'DIGIT', v:'1'}}]);
//n2.addParent(n3);

// Naive SSA Transform
function ssatransform(n, liveVars) {
    function ssa(i) {
        return { t:'VAR', v: i+'_'+liveVars[i] };
    }

    // add psi
    if(n.parents.length > 1) {
        for(var i in liveVars) {
            var psi = ssa(i);
            liveVars[i]++;
            if(n.psi[i] == undefined) n.psi[i] = [ssa(i)];
            n.psi[i].push(psi);
        }
    }

    if(n.visited == 'ssa')
        return;
    n.visited = 'ssa';

    // apply SSA to instructions
    for(var i in n.ins) {
        var ins = n.ins[i];
        if( liveVars[ins.w] == undefined )
            liveVars[ins.w] = 0;

        if( ins.r1.t == 'VAR' ) {
            ins.r1 = ssa(ins.r1.v);
        }
        if( ins.r2 && ins.r2.t == 'VAR' ) {
            ins.r2 = ssa(ins.r2.v);
        }
        liveVars[ins.w]++;
        ins.w = ssa(ins.w);
    }

    for(var i in n.children) {
        ssatransform(n.children[i], liveVars); 
    }
}

ssatransform(n1, {});

// TODO reduce ssa form to instructions
function print(n) {
    if(n.visited == 'print')
        return;
    n.visited = 'print';

    console.log("# "+n.name);

    // print psi func 
    for(var i in n.psi) {
        console.log(n.psi[i][0].v,'=','psi(',n.psi[i].map(x => x.v).splice(1).join(', '), ')');
    }

    // apply SSA to instructions
    for(var i in n.ins) {
        var ins = n.ins[i];
        if(ins.r2)
            console.log(ins.w.v,'=',ins.r1.v,'*',ins.r2.v);
        else
            console.log(ins.w.v,'=',ins.r1.v);
    }

    for(var i in n.children) {
        print(n.children[i]); 
    }
}

print(n1);