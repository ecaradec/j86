# J86
J86 is a multipass compiler that is structured to apply compiler optimisations techniques down to x86 assembly. The language is sort of C like. The project is mostly focused on good structure for applying optimisation. The syntax supports functions, variables, if and while control flow constructions and 32 bits integers.

Here is a recursion examples: 
```
FUNCTION fact(i : INT32) : INT32 {
    IF( i == 1 ) { RETURN 1; }
    RETURN i * fact(i-1);
}

FUNCTION main() : INT32 {
    LET a:INT32 = fact(5);
    IF( a == 120 ) {
        printf("RECURSION OK");
    } ELSE {
        printf("RECURSION NOK");
    }
    RETURN 0;
}
```

Here is a while loop test:
```
FUNCTION main() : INT32 {
    LET a : INT32 = 0;
    WHILE(a != 10) {
        a = a + 1;
    }
    IF(a == 10) {
        printf("WHILE OK");
    } ELSE {
        printf("WHILE NOK");
    }
    RETURN 0;
}
```

You can find a few more examples in examples in the project.

The simplest way to try it is to use the following that build, assemble, link and run executable through a docker container configured with all necessary tools:

./run.sh function.msl

It is also possible to run the compiler through node directly, by running the line below, which output assembly code in file.asm.

nodejs /code/src/compiler.js /code/examples/function.msl

The compiler works in multiple passes. It's possible to print output of each pass by adding the --debug to the compiler. Working in passes in very useful as it allows to spot issues in higher passes which are less verbose than what full assembled code can be.

# Optimisations

The optimisations currently applied are:
- Register allocation:
  - Instead of storing variable in memory, use registers if available. The implementation use graph coloration algorithm for selecting a good selection.
  - If no registers are available, the compiler use spill variables for storing results.
- Variable and constants propagation:
  - When a variable is assigned to another variable, the first variable can be used as a replacement for the second one: a = 1; b = a; c = b; can be replaced by a = 1; b = a; c = a;. 
- Dropping unused instructions:
  -  If a value is never read, operations that produced it are not necessary to even compute it. The compiler does this in simple cases. Its effectiveness is improved by the variables and constants propagation.

## SSA transform

One of the interesting aspect of the compiler is the transformation of the code to SSA form using classical R. CYTRON paper here: https://www.cs.utexas.edu/~pingali/CS380C/2010/papers/ssaCytron.pdf
R. This is the same algorithm LLVM use. This use the notion of dominance frontier, which is a graph theory notion. I used the following paper for implementation https://www.cs.rice.edu/~keith/EMBED/dom.pdf.

Both papers are a bit of a dense read, so if you want to get a introduction to SSA transform, I recommend this set of slides: https://web.stanford.edu/class/archive/cs/cs143/cs143.1128/lectures/17/Slides17.pdf.

## TODO

*   [x] support of return values
*   [x] support of parameters in calls
*   [x] spill variable handling (variable not replaced by registers are spill variable possibly ) ?
*   [x] recycle spill variable
*   [x] save and restore registers in callee
*   [x] allocate space on stack for local variables
*   [x] support of string
*   [x] support of printing
*   [x] output to NASM format
*   [x] replace load and store by marking variables on SSA on first use (and only use store explicitly)
*   [x] replace store->load by replacement of the register
*   [x] replace load->load by replacement of the register
*   [x] support of callee and caller registers 
*   [x] compute process dominance function by function
*   [ ] support of global variables
*   [ ] support of types (int and int*)
*   [ ] use a keyword for declaring value instead of just initializing it ?
*   [ ] let functions returns values by pointer or in eax depending of size
*   [ ] support of structures
*   [ ] Handle larger types like int64 by adding a way to address partial variable in IR ?
*   [ ] support of int64 using adc