// Naive SSA Transform
function ssatransform(n, parent, liveVars) {    
    function ssa(i) {
        return { t:'VAR', v: i+'_'+liveVars[i] };
    }    

    if(n.visited == 'ssa')
        return;
    n.visited = 'ssa';

    // apply SSA to instructions
    for(var i in n.assembly) {
        var ins = n.assembly[i];
        if(ins.w) {
            if( ins.w.t == 'VAR' && liveVars[ins.w.v] == undefined )
                liveVars[ins.w.v] = 0;
        }

        if( ins.r1 && ins.r1.t == 'VAR' ) {
            ins.r1 = ssa(ins.r1.v);
        }
        if( ins.r2 && ins.r2.t == 'VAR' ) {
            ins.r2 = ssa(ins.r2.v);
        }
        if( ins.w && ins.w.t == 'VAR' ) {
            liveVars[ins.w.v]++;
            ins.w = ssa(ins.w.v);            
        }
    }

    for(var i in n.children) {
        // add psi
        var c = n.children[i];
        if(c.parents.length > 1) {
            for(var j in liveVars) {
                var r = ssa(j);
                liveVars[j]++;
                if(c.psi[j] == undefined) {
                    var w = ssa(j);
                    c.psi[j] = [w];
                }
                r.src = n;
                c.psi[j].push(r);
            }
        }

        ssatransform(n.children[i], n, liveVars); 
    }
}

module.exports = ssatransform;