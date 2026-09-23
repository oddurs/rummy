<script lang="ts">
  import { category } from '$lib/roadmap';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const repo = 'https://github.com/oddurs/rummy/blob/main/cairn/items';
  const bar = (done: number, total: number, width = 24) => {
    const filled = total ? Math.round((done / total) * width) : 0;
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  };
</script>

<svelte:head>
  <title>roadmap · rummy</title>
</svelte:head>

<div class="wrap page">
  <h1>Roadmap</h1>
  <p class="muted lede">
    Every item is a Markdown file in <code>cairn/items/</code>, managed with
    <a href="https://github.com/oddurs/cairn">cairn</a>, and this page reads them on the server. {data.count} items,
    {data.source === 'live' ? 'read live from the repository' : 'from the snapshot taken at build time'}.
  </p>

  {#each data.milestones as ms (ms.key)}
    <section>
      <header>
        <h2><span class="key">{ms.key}</span> {ms.title}</h2>
        <p class="progress" aria-label="{ms.done} of {ms.total} done">
          <span class="bar" aria-hidden="true">{bar(ms.done, ms.total)}</span>
          <span class="muted">{ms.done}/{ms.total}{ms.due ? ` · due ${ms.due}` : ''}</span>
        </p>
        {#if ms.summary}<p class="muted summary">{ms.summary}</p>{/if}
      </header>
      <ul>
        {#each ms.items as item (item.id)}
          <li class={category(item.status)}>
            <span class="status">{item.status}</span>
            <a href="{repo}/{item.file}">{item.title}</a>
            <span class="tags muted">
              {String(item.id).padStart(4, '0')}{item.priority ? ` · ${item.priority}` : ''}{item.pillar ? ` · ${item.pillar}` : ''}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .page {
    padding-block: 3rem 2rem;
  }
  h1 {
    font-size: clamp(2rem, 5vw, 3rem);
  }
  .lede {
    max-width: 44rem;
  }
  section {
    margin-top: 3rem;
  }
  h2 {
    font-size: 1.3rem;
    margin-bottom: 0.4rem;
  }
  .key {
    color: var(--accent);
  }
  .progress {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 0.5rem;
    font-size: 13px;
  }
  .bar {
    color: var(--accent);
    letter-spacing: -1px;
  }
  .summary {
    max-width: 44rem;
    margin: 0 0 1rem;
    font-size: 14px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }
  li {
    display: grid;
    grid-template-columns: 7rem 1fr auto;
    gap: 1rem;
    align-items: baseline;
    padding: 0.45rem 0;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  li a {
    color: var(--fg);
  }
  .status {
    font-size: 12px;
    color: var(--dim);
  }
  li.active .status {
    color: #ffd27a;
  }
  li.done .status {
    color: var(--accent);
  }
  li.done a {
    color: var(--dim);
  }
  .tags {
    font-size: 12px;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    li {
      grid-template-columns: 1fr;
      gap: 0.1rem;
    }
  }
</style>
