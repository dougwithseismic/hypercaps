import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "Getting Started",
      items: ["installation", "usage"],
    },
    {
      type: "category",
      label: "Features",
      items: ["advanced-features", "keyboard-shortcuts"],
    },
    {
      type: "category",
      label: "Help & Support",
      items: ["faq", "troubleshooting"],
    },
    {
      type: "category",
      label: "Community",
      items: ["contributing", "code-of-conduct"],
    },
  ],
};

export default sidebars;
