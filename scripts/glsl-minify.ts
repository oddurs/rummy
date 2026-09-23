import type { Plugin } from 'vite';

/**
 * Minify GLSL in `/* glsl *\/` template literals at build time: strip comments,
 * collapse whitespace, keep preprocessor lines on their own lines. Source stays
 * readable; the bundle doesn't ship the formatting.
 */
export function minifyGlsl(source: string): string {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  let out = '';
  for (const raw of stripped.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      out += `${out && !out.endsWith('\n') ? '\n' : ''}${line}\n`;
      continue;
    }
    const tight = line.replace(/\s+/g, ' ').replace(/\s*([{}();,=<>*/!?:&|[\]])\s*/g, '$1');
    out += out && !out.endsWith('\n') ? ` ${tight}` : tight;
  }
  return out;
}

export function glsl(): Plugin {
  return {
    name: 'rummy-glsl-minify',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!id.endsWith('.ts') || !code.includes('/* glsl */')) return null;
      const next = code.replace(/\/\* glsl \*\/ `([\s\S]*?)`/g, (_, body: string) => {
        // Interpolations (${...}) are other minified shaders; leave them intact.
        const parts = body.split(/(\$\{[^}]*\})/);
        return `\`${parts.map((p) => (p.startsWith('${') ? p : minifyGlsl(p))).join('\n')}\``;
      });
      return { code: next, map: null };
    },
  };
}
