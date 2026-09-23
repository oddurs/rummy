<!--
  A rummy canvas that owns its instance: created on mount, updated in place
  when `options` change (no new WebGL context), destroyed on unmount. On the
  server it renders an empty canvas; the scene starts once hydrated.
-->
<script lang="ts">
  import { Rummy, type RummyOptions } from '@oddurs/rummy';
  import { untrack } from 'svelte';

  interface Props {
    options?: Partial<RummyOptions>;
    paused?: boolean;
    class?: string;
    /** The live instance, for reading `stats` or calling methods. */
    instance?: Rummy | null;
  }

  let { options = {}, paused = false, class: className = '', instance = $bindable(null) }: Props = $props();

  let canvas: HTMLCanvasElement;
  let unsupported = $state(false);

  $effect(() => {
    let rummy: Rummy;
    try {
      rummy = new Rummy(canvas, untrack(() => $state.snapshot(options)) as Partial<RummyOptions>);
    } catch {
      // No WebGL2: leave the canvas empty rather than break the page.
      unsupported = true;
      return;
    }
    instance = rummy;
    return () => {
      rummy.destroy();
      instance = null;
    };
  });

  $effect(() => {
    const next = $state.snapshot(options) as Partial<RummyOptions>;
    untrack(() => instance)?.set(next);
  });

  $effect(() => {
    if (!instance) return;
    if (paused) instance.pause();
    else instance.play();
  });
</script>

<canvas bind:this={canvas} class={className} class:unsupported aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .unsupported {
    background: radial-gradient(circle at 60% 40%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%);
  }
</style>
