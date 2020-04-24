rm -f /code/file.asm /code/file.o /code/file
nodejs /code/src/compiler.js /code/examples/function.msl > /code/file.asm
nasm -f elf /code/file.asm -o /code/file.o && gcc -m32 -static -Os -nostartfiles -fno-asynchronous-unwind-tables -o /code/file /code/file.o
/code/file
