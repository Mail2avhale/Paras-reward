import { buildPrefill } from '/app/memory/tmp/rz.mjs';
for (const u of [{name:'A',email:'abc@gmail.com',mobile:'+91 98765 43210'},{name:'B',email:'9876543210',mobile:'9876543210'},{name:'C',email:'x@gmail',mobile:'12345'},{name:'D',email:' Raj.K@Gmail.com ',mobile:'09876543210'},{name:'E'}]) console.log(JSON.stringify(buildPrefill(u)));
