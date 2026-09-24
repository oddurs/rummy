<script lang="ts">
  import { scenes, type Rummy as Engine, type RummyOptions, type SceneName } from '@oddurs/rummy';
  import { lookDefaults, looks, type LookName } from '$demo/looks';
  import Rummy from '$lib/Rummy.svelte';

  let width = $state(1200);
  let hero = $state<Engine | null>(null);
  let stats = $state('');

  // Sun to the right of the copy on wide screens, above it on narrow ones.
  const offset = $derived<[number, number]>(width > 900 ? [0.55, 0] : [0, 0.35]);
  const heroOptions = $derived<Partial<RummyOptions>>({
    ...lookDefaults,
    ...looks.phosphor.options,
    scene: scenes.terrain,
    intro: 'type',
    pointer: true,
    offset,
  });

  $effect(() => {
    const id = setInterval(() => {
      if (!hero) return;
      const s = hero.stats;
      const px = s.width * s.height;
      stats = `${s.columns}×${s.rows} cells · ${s.samples.toLocaleString()} samples shaded (${((s.samples / Math.max(px, 1)) * 100).toFixed(1)}% of the pixels)`;
    }, 1000);
    return () => clearInterval(id);
  });

  const tiles: { scene: SceneName; look: LookName; blurb: string }[] = [
    { scene: 'ring', look: 'scene', blurb: 'a twisted torus, lit like brushed metal' },
    { scene: 'globe', look: 'ice', blurb: 'continents, a graticule, a thin atmosphere' },
    { scene: 'tunnel', look: 'crt', blurb: 'a wireframe tunnel through a curved screen' },
    { scene: 'blobs', look: 'amber', blurb: 'liquid metal that follows the pointer' },
    { scene: 'terrain', look: 'cga', blurb: 'the valley again, in four CGA colours' },
  ];

  const cost = [
    ['ring', '1.25'],
    ['terrain', '1.73'],
    ['blobs', '1.55'],
    ['globe', '1.30'],
    ['tunnel', '0.98'],
  ];

  const usage = `import { Rummy, scenes } from '@oddurs/rummy';

const rummy = new Rummy(canvas, {
  scene: scenes.terrain,
  fg: '#ffb000',
  glow: 0.4,
});

rummy.set({ crt: true }); // change anything live`;

  const custom = `const pulse = /* glsl */ \`
#define STILL 1.5
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  float r = length(p - uMouse * 0.5);
  float ring = smoothstep(0.05, 0.0, abs(r - 0.5 - 0.1 * sin(uTime * 2.0)));
  return vec4(vec3(ring), r);
}\`;`;
</script>

<svelte:window bind:innerWidth={width} />

<section class="hero">
  <Rummy class="bg" options={heroOptions} bind:instance={hero} />
  <div class="wrap copy">
    <div class="card">
      <p class="prompt"><span>~/rummy</span> $ render --scene <b>terrain</b></p>
      <h1>3D scenes,<br />rendered in text.</h1>
      <p class="lede">
        A tiny WebGL2 engine that turns raymarched scenes, video and canvases into live ASCII. It shades one sample
        per glyph region instead of every pixel, so a full-screen hero costs about a millisecond.
      </p>
      <div class="actions">
        <a class="btn" href="/play">open the playground</a>
        <a class="btn ghost" href="https://github.com/oddurs/rummy">github</a>
      </div>
    </div>
  </div>
  <p class="stats muted" aria-live="off">{stats}</p>
</section>

<section class="wrap block">
  <h2>Every scene, live</h2>
  <p class="muted">Each tile is its own renderer. Tiles you scroll past stop drawing.</p>
  <div class="tiles">
    {#each tiles as tile (tile.scene)}
      <a class="tile" href="/play?scene={tile.scene}&look={tile.look}">
        <div class="frame">
          <Rummy
            options={{ ...lookDefaults, ...looks[tile.look].options, scene: scenes[tile.scene], fontSize: 9, mouse: false }}
          />
        </div>
        <span class="name">{tile.scene}<span class="muted">&nbsp;· {tile.look}</span></span>
        <span class="muted blurb">{tile.blurb}</span>
      </a>
    {/each}
  </div>
</section>

<section class="wrap block how">
  <h2>How it works</h2>
  <div class="cols">
    <div>
      <h3>Shade cells, not pixels</h3>
      <p class="muted">
        Each character gets 2×3 samples of your scene. At 1080p that's about 6% of the pixels, so scenes can afford
        long raymarches and layered noise.
      </p>
    </div>
    <div>
      <h3>Pick glyphs by shape</h3>
      <p class="muted">
        Every glyph is measured into a 6D shape vector and each cell picks the nearest one, so edges become
        <code>/ \ | _</code> instead of a brightness ramp.
      </p>
    </div>
    <div>
      <h3>Effects at cell resolution</h3>
      <p class="muted">
        Glow, exposure, palettes and anti-aliasing all run over the cell grid, which is thousands of texels instead of
        millions of pixels.
      </p>
    </div>
  </div>
</section>

<section class="wrap block">
  <h2>What it costs</h2>
  <p class="muted">GPU time per frame at 1920×1080 on an Apple M4, measured with timer queries.</p>
  <div class="table">
    <table>
      <thead><tr><th>scene</th><th>ms / frame</th><th></th></tr></thead>
      <tbody>
        {#each cost as [scene, ms] (scene)}
          <tr>
            <td>{scene}</td>
            <td>{ms}</td>
            <td class="bar" aria-hidden="true">{'█'.repeat(Math.round(Number(ms) * 10))}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="wrap block">
  <h2>Use it</h2>
  <div class="cols two">
    <div>
      <h3>Drop it behind a headline</h3>
      <pre><code>{usage}</code></pre>
    </div>
    <div>
      <h3>Or write your own scene</h3>
      <pre><code>{custom}</code></pre>
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .hero :global(.bg) {
    position: absolute;
    inset: 0;
  }
  .copy {
    position: relative;
    width: 100%;
  }
  .card {
    max-width: 34rem;
    padding: 1.5rem 1.75rem;
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    backdrop-filter: blur(2px);
    border: 1px solid var(--line);
  }
  .prompt {
    margin: 0 0 1rem;
    color: var(--dim);
  }
  .prompt span {
    color: var(--accent);
  }
  .prompt b {
    color: var(--fg);
    font-weight: 500;
  }
  h1 {
    font-size: clamp(2.1rem, 5.4vw, 3.6rem);
    line-height: 1.02;
    letter-spacing: -0.035em;
  }
  .lede {
    color: color-mix(in srgb, var(--fg) 80%, var(--bg));
    margin: 0 0 1.5rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .stats {
    position: absolute;
    left: var(--gutter);
    bottom: 1rem;
    margin: 0;
    font-size: 12px;
  }
  .block {
    padding-block: 5rem 1rem;
  }
  h2 {
    font-size: 1.6rem;
  }
  h3 {
    font-size: 1rem;
    color: var(--accent);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    gap: 1.25rem;
    margin-top: 2rem;
  }
  .tile {
    display: grid;
    gap: 0.3rem;
    color: var(--fg);
  }
  .tile:hover {
    text-decoration: none;
  }
  .frame {
    aspect-ratio: 16 / 10;
    border: 1px solid var(--line);
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .tile:hover .frame {
    border-color: var(--accent);
  }
  .name {
    font-weight: 500;
  }
  .blurb {
    font-size: 13px;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 2rem;
    margin-top: 1.5rem;
  }
  .cols.two {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
  }
  .how p {
    margin: 0;
  }
  .table {
    overflow-x: auto;
    margin-top: 1.5rem;
  }
  table {
    border-collapse: collapse;
    min-width: 28rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 1.5rem 0.35rem 0;
    border-bottom: 1px solid var(--line);
  }
  th {
    color: var(--dim);
    font-weight: 400;
  }
  .bar {
    color: var(--accent);
    letter-spacing: -1px;
  }
  @media (max-width: 720px) {
    .hero {
      align-items: flex-end;
      padding-bottom: 4rem;
    }
  }
</style>
