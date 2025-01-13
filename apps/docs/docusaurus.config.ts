import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "HyperCaps",
  tagline: "The Keyboard Hack for Windows Users Living at Mach 10",
  favicon: "img/favicon.ico",

  url: "https://docs.hypercaps.dev",
  baseUrl: "/",

  organizationName: "withseismic",
  projectName: "hypercaps",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/withseismic/hypercaps/tree/main/apps/docs/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl:
            "https://github.com/withseismic/hypercaps/tree/main/apps/docs/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/hypercaps-social-card.jpg",
    navbar: {
      title: "HyperCaps",
      logo: {
        alt: "HyperCaps Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: "https://github.com/withseismic/hypercaps",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/docs/intro",
            },
            {
              label: "Installation",
              to: "/docs/installation",
            },
            {
              label: "Usage Guide",
              to: "/docs/usage",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord",
              href: "https://discord.gg/hypercaps",
            },
            {
              label: "GitHub Issues",
              href: "https://github.com/withseismic/hypercaps/issues",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Blog",
              to: "/blog",
            },
            {
              label: "GitHub",
              href: "https://github.com/withseismic/hypercaps",
            },
            {
              label: "Seismic",
              href: "https://withseismic.com",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Seismic. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
