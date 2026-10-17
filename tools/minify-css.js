/**
 * minify-css.js — CSS minifier used by build.js.
 *
 * The old hand-rolled regex stripped whitespace around ':' and '+' everywhere,
 * which deleted the descendant space in `html[data-theme="dark"] :is(...)`
 * (turning it into a compound selector that never matched) and rewrote text
 * inside attribute strings like [style*="position: fixed"]. Production dark
 * mode broke while local, unminified CSS worked. clean-css parses the CSS, so
 * selectors and quoted strings survive; level 1 only rewrites values safely
 * (and unquotes identifier attribute values, e.g. [data-theme=dark]).
 */
const CleanCSS = require('clean-css');

const minifier = new CleanCSS({ level: 1, compatibility: '*' });

function minifyCss(css) {
    const result = minifier.minify(css);
    // clean-css reports a rule it cannot parse as a warning and drops it, so
    // any warning means the output is not the authored stylesheet.
    const problems = [].concat(result.errors || [], result.warnings || []);
    if (problems.length) {
        throw new Error('CSS minification failed: ' + problems.join('; '));
    }
    return result.styles;
}

module.exports = { minifyCss };
