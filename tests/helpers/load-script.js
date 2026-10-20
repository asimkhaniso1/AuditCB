// Loads a browser script (a root *.js file the app ships as a plain <script>)
// the way the tests used to with eval / new Function, but compiled under the
// file's real path. V8 coverage credits code by script URL, so code run via
// eval / new Function counted for no file and coverage read ~10% with the
// biggest modules at 0% even though tests exercised them.
//
// loadScript(file, { params, append, global })
//   params  — values for free variables the source refers to, like the old
//             new Function('window', 'module', src)(win, undefined) idiom.
//             Keys become parameter names, in insertion order.
//   append  — extra source run after the file (e.g. '\nreturn someFn;'), so
//             the result is whatever it returns. Appended text comes after the
//             file's last byte, so coverage offsets still line up.
//   global  — true to run at global scope, like indirect (0, eval)(src): top-
//             level function declarations become globals. Default runs inside a
//             function scope, like new Function / strict direct eval.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function loadScript(file, { params = {}, append = '', global = false } = {}) {
    const abs = path.resolve(file);
    const filename = pathToFileURL(abs).href;
    const src = fs.readFileSync(abs, 'utf8');
    if (global) {
        // Indirect eval (not vm.runInThisContext): a script's top-level
        // let/const would persist as global bindings, so loading the same file
        // twice would throw "already declared". The sourceURL comment names the
        // eval'd script for V8, and the source is byte-identical to the file,
        // so coverage offsets line up.
        return (0, eval)(src + append + '\n//# sourceURL=' + filename);
    }
    const names = Object.keys(params);
    const fn = vm.compileFunction(src + append, names, { filename });
    return fn(...names.map(n => params[n]));
}
