import { defineConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress'
import {
  groupIconMdPlugin,
} from 'vitepress-plugin-group-icons'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
// @ts-ignore
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs'


const sidebars = (): DefaultTheme.SidebarItem[] => [
  {
    text: 'Getting Started',
    items: [
      { 
        text: 'Fourtwo Quickstart', 
        link: '/docs/' 
      },
      { 
        text: 'Configure JSX with Typescript', 
        link: '/docs/01-getting-started/02-configure-jsx-with-typescript' 
      },
    ],
  },
  {
    text: 'JSX Workflows',
    items: [
      {
        text: "CLI Basics"
      },
      {
        text: 'Github Actions',
        collapsed: true,
        items: [
          {
            text: "Creating a GHA workflow"
          },
          {
            text: "Generating GHA yaml"
          },
          {
            text: "Workflow naming defaults"
          },
          {
            text: "Github Actions Builder API"
          }
        ]
      },  
      {
        text: 'AWS CodeCatalyst',
        collapsed: true,
        items: [
          {
            text: "Creating a CodeCatalyst workflow"
          },
          {
            text: "Generating CodeCatalyst yaml"
          },
          {
            text: "Workflow naming defaults"
          },
          {
            text: "CodeCatalyst Builder API"
          }
        ]
      },  
    ]
  },    
  {
    text: "Builders",
    items: [
      {
        text: "AWS CodeDeploy"
      },
      {
        text: "AWS CodeBuild"
      },
      {
        text: "Devfile"
      }
    ]
  },
  {
    text: "CLI Commands",
    items: [
      {
        text: "github",
        items: [
          {
            text: "workflows",
          }
        ]
      },
      {
        text: "aws",
        items: [
          {
            text: "codedeploy"
          },
          {
            text: "codebuild"
          },
          {
            text: "codecatalyst"
          },
        ]
      },
    ]
  },
]

export default defineConfig({
  title: "Fourtwo",
  description: "Developer reference website for the Fourtwo CLI",
  lastUpdated: true,
  ignoreDeadLinks: true,
  cleanUrls: true,
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    config(md) {
      md.use(groupIconMdPlugin)
    },
    codeTransformers: [
      transformerTwoslash({
        typesCache: createFileSystemTypesCache(),
      }),
    ],
  },  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/docs' }
    ],
    sidebar: sidebars(),
    socialLinks: [
      { icon: 'github', link: 'https://github.com/levicape/fourtwo' }
    ]
  }
})
