import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Curatarr',
  description: 'Intelligent Media Library Auditing and Decluttering Platform',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#040705' }],
  ],
  appearance: 'force-dark',
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Curatarr',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Core Concepts', link: '/guide/smart-categories' },
      { text: 'MCP Integration', link: '/guide/mcp-agent' },
      { text: 'API Reference', link: '/reference/api' },
      { text: 'GitHub', link: 'https://github.com/spelech/curatarr' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/guide/getting-started' },
          { text: 'Connections Setup', link: '/guide/connections' },
        ],
      },
      {
        text: 'Core Features',
        items: [
          { text: 'Smart Categories', link: '/guide/smart-categories' },
          { text: 'Safe Pruning & Deletion', link: '/guide/safe-pruning' },
          { text: 'Dynamic Watch Cutoff', link: '/guide/watch-history' },
          { text: 'Whitelist & Guest Requests', link: '/guide/whitelist-protection' },
          { text: 'Quality Profile Upgrades', link: '/guide/quality-upgrades' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Model Context Protocol (MCP)', link: '/guide/mcp-agent' },
          { text: 'REST API Reference', link: '/reference/api' },
          { text: 'Configuration & Schema', link: '/reference/configuration' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/spelech/curatarr' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Steven Pelech & Curatarr Contributors',
    },
  },
});
