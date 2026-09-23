<script lang="ts">
  import { charsets, palettes, scenes, type RummyOptions, type SceneName, type Rummy as Engine } from '@oddurs/rummy';
  import { lookDefaults, looks, type LookName } from '$demo/looks';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { onMount } from 'svelte';
  import Rummy from '$lib/Rummy.svelte';

  type Quantize = keyof typeof palettes | 'none';

  const initial = {
    scene: 'ring' as SceneName,
    look: 'phosphor' as LookName,
    charset: 'ascii' as keyof typeof charsets,
    mode: 'shape' as RummyOptions['mode'],
    quantize: 'none' as Quantize,
    fontSize: 12,
    contrast: 1.6,
    directionalContrast: 2,
    edges: 0.6,
    gain: 0.85,
    antialias: 0.6,
    glow: -1,
    cellBackground: -1,
    crt: false,
    paused: false,
  };
  type State = typeof initial;

  let s = $state<State>({ ...initial });
  let open = $state(true);
  let ready = $state(false);
  // replaceState throws until the router has finished its first navigation.
  let routerReady = $state(false);
  afterNavigate(() => (routerReady = true));
  let engine = $state<Engine | null>(null);
  let fps = $state(0);

  // -1 on a slider means "whatever the look says".
  const orLook = (v: number, look: number | undefined) => (v < 0 ? (look ?? 0) : v);

  const options = $derived.by<Partial<RummyOptions>>(() => {
    const look: Partial<RummyOptions> = { ...lookDefaults, ...looks[s.look].options };
    return {
      ...look,
      scene: scenes[s.scene],
      charset: charsets[s.charset],
      mode: s.mode,
      fontSize: s.fontSize,
      contrast: s.contrast,
      directionalContrast: s.directionalContrast,
      edges: s.edges,
      gain: s.gain,
      antialias: s.antialias,
      glow: orLook(s.glow, look.glow),
      cellBackground: orLook(s.cellBackground, look.cellBackground),
      palette: s.quantize === 'none' ? (look.palette ?? null) : palettes[s.quantize],
      colorMix: s.quantize === 'none' ? look.colorMix : 1,
      crt: s.crt || look.crt || false,
    };
  });

  const theme = $derived(looks[s.look].theme as { accent: string; text: string; dim: string; light?: boolean });
  const bg = $derived(looks[s.look].options.bg ?? '#000');

  onMount(() => {
    const params = new URLSearchParams(location.search);
    const next = { ...initial } as Record<string, unknown>;
    for (const [k, raw] of params) {
      if (!(k in initial)) continue;
      const cur = initial[k as keyof State];
      next[k] = typeof cur === 'number' ? Number(raw) : typeof cur === 'boolean' ? raw === '1' : raw;
    }
    if (!(String(next.scene) in scenes)) next.scene = initial.scene;
    if (!(String(next.look) in looks)) next.look = initial.look;
    if (!(String(next.charset) in charsets)) next.charset = initial.charset;
    if (next.quantize !== 'none' && !(String(next.quantize) in palettes)) next.quantize = 'none';
    s = next as State;
    open = innerWidth > 720;
    ready = true;
    const id = setInterval(() => (fps = engine?.stats.fps ?? 0), 500);
    return () => clearInterval(id);
  });

  // Keep the URL shareable.
  $effect(() => {
    if (!ready || !routerReady) return;
    const params = new URLSearchParams();
    for (const k of Object.keys(initial) as (keyof State)[]) {
      const v = s[k];
      if (v !== initial[k]) params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    const qs = params.toString();
    replaceState(qs ? `?${qs}` : location.pathname, {});
  });

  const shown = (v: number, look: number | undefined) => orLook(v, look).toFixed(2);
</script>

<svelte:head>
  <title>play · rummy</title>
</svelte:head>

<div class="stage" style:--bg={bg} style:--accent={theme.accent} style:--fg={theme.text} style:--dim={theme.dim}>
  {#if ready}
    <Rummy options={options} paused={s.paused} transition="decode" bind:instance={engine} />
  {/if}

  <aside class="panel" class:open>
    <button class="toggle" onclick={() => (open = !open)} aria-expanded={open}>{open ? '[-]' : '[+]'} tune</button>
    {#if open}
      <form onsubmit={(e) => e.preventDefault()}>
        <label>scene
          <select bind:value={s.scene}>
            {#each Object.keys(scenes) as name (name)}<option>{name}</option>{/each}
          </select>
        </label>
        <label>look
          <select bind:value={s.look}>
            {#each Object.keys(looks) as name (name)}<option>{name}</option>{/each}
          </select>
        </label>
        <label>charset
          <select bind:value={s.charset}>
            {#each Object.keys(charsets) as name (name)}<option>{name}</option>{/each}
          </select>
        </label>
        <label>mode
          <select bind:value={s.mode}><option>shape</option><option>density</option></select>
        </label>
        <label>quantize
          <select bind:value={s.quantize}>
            <option>none</option>
            {#each Object.keys(palettes) as name (name)}<option>{name}</option>{/each}
          </select>
        </label>
        <label>font size <output>{s.fontSize}</output>
          <input type="range" min="6" max="28" step="1" bind:value={s.fontSize} />
        </label>
        <label>contrast <output>{s.contrast}</output>
          <input type="range" min="1" max="4" step="0.05" bind:value={s.contrast} />
        </label>
        <label>neighbour contrast <output>{s.directionalContrast}</output>
          <input type="range" min="1" max="5" step="0.05" bind:value={s.directionalContrast} />
        </label>
        <label>edges <output>{s.edges}</output>
          <input type="range" min="0" max="1" step="0.01" bind:value={s.edges} />
        </label>
        <label>gain <output>{s.gain}</output>
          <input type="range" min="0.3" max="3" step="0.01" bind:value={s.gain} />
        </label>
        <label>glow <output>{shown(s.glow, options.glow)}</output>
          <input type="range" min="0" max="1" step="0.01" value={orLook(s.glow, options.glow)}
            oninput={(e) => (s.glow = Number(e.currentTarget.value))} />
        </label>
        <label>two-tone cells <output>{shown(s.cellBackground, options.cellBackground)}</output>
          <input type="range" min="0" max="1" step="0.01" value={orLook(s.cellBackground, options.cellBackground)}
            oninput={(e) => (s.cellBackground = Number(e.currentTarget.value))} />
        </label>
        <label>antialias <output>{s.antialias}</output>
          <input type="range" min="0" max="1" step="0.01" bind:value={s.antialias} />
        </label>
        <label class="check"><input type="checkbox" bind:checked={s.crt} /> crt</label>
        <label class="check"><input type="checkbox" bind:checked={s.paused} /> paused</label>
        <p class="meta">{fps.toFixed(0)} fps · <button type="button" class="link" onclick={() => (s = { ...initial })}>reset</button></p>
      </form>
    {/if}
  </aside>
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    background: var(--bg);
    color: var(--fg);
    transition: background 0.3s;
  }
  .panel {
    position: absolute;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: min(290px, calc(100vw - 32px));
    max-height: calc(100svh - 96px);
    overflow: auto;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    backdrop-filter: blur(6px);
    font-size: 12px;
  }
  .panel:not(.open) {
    width: auto;
  }
  .toggle {
    all: unset;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    color: var(--accent);
    cursor: pointer;
  }
  form {
    display: grid;
    gap: 0.6rem;
    padding: 0 0.75rem 0.75rem;
  }
  label {
    display: grid;
    gap: 0.2rem;
    color: var(--dim);
  }
  label.check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  output {
    float: right;
    color: var(--fg);
  }
  select,
  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }
  select {
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    padding: 0.25rem;
  }
  .meta {
    margin: 0.25rem 0 0;
    color: var(--dim);
  }
  .link {
    all: unset;
    color: var(--accent);
    cursor: pointer;
  }
</style>
