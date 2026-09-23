<script lang="ts">
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/500.css';
  import '@fontsource/jetbrains-mono/700.css';
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();

  const nav = [
    { href: '/', label: 'home' },
    { href: '/play', label: 'play' },
    { href: '/roadmap', label: 'roadmap' },
  ];
</script>

<svelte:head>
  <title>rummy — 3D scenes rendered as ASCII</title>
  <meta name="description" content="Real-time 3D scenes rendered as ASCII in WebGL2. Built for hero backgrounds." />
</svelte:head>

<header class:overlay={page.url.pathname === '/' || page.url.pathname === '/play'}>
  <nav class="wrap">
    <a class="logo" href="/">rummy<span class="cursor">_</span></a>
    <ul>
      {#each nav as item (item.href)}
        <li>
          <a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
        </li>
      {/each}
      <li><a href="https://github.com/oddurs/rummy">github</a></li>
    </ul>
  </nav>
</header>

<main>
  {@render children()}
</main>

{#if page.url.pathname !== '/play'}
  <footer class="wrap">
    <span class="muted">rummy · MIT · shape vectors after Alex Harri, silhouettes after Acerola</span>
    <a href="https://github.com/oddurs/rummy">source</a>
  </footer>
{/if}

<style>
  header {
    position: relative;
    z-index: 10;
    border-bottom: 1px solid var(--line);
  }
  header.overlay {
    position: absolute;
    inset: 0 0 auto;
    border-bottom: 0;
    /* Keeps the nav legible over the brightest part of any scene. */
    background: linear-gradient(var(--bg) 35%, transparent);
    padding-bottom: 1.5rem;
  }
  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 1rem;
  }
  .logo {
    color: var(--fg);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .cursor {
    color: var(--accent);
    animation: blink 1.1s steps(1) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursor {
      animation: none;
    }
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  ul a {
    color: var(--dim);
  }
  ul a:hover,
  ul a[aria-current='page'] {
    color: var(--accent);
    text-decoration: none;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 3rem 2rem;
    border-top: 1px solid var(--line);
    font-size: 13px;
  }
</style>
