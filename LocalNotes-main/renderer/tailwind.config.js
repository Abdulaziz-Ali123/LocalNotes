const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './renderer/pages/**/*.{js,ts,jsx,tsx}',
    './renderer/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(46, 52, 64)', // Nord0
        foreground: 'rgb(236, 239, 244)', // Nord6
        card: {
          DEFAULT: 'rgb(46, 52, 64)', // Nord1-2
          foreground: 'rgb(236, 239, 244)',
        },
        popover: {
          DEFAULT: 'rgb(46, 52, 64)',
          foreground: 'rgb(236, 239, 244)',
        },
        primary: {
          DEFAULT: 'rgb(136, 192, 208)', // Nord8
          foreground: 'rgb(46, 52, 64)',
        },
        secondary: {
          DEFAULT: 'rgb(59, 66, 82)', // Nord2-3
          foreground: 'rgb(236, 239, 244)',
        },
        muted: {
          DEFAULT: 'rgb(59, 66, 82)',
          foreground: 'rgb(216, 222, 233)',
        },
        accent: {
          DEFAULT: 'rgb(129, 161, 193)', // Nord10
          foreground: 'rgb(236, 239, 244)',
        },
        destructive: {
          DEFAULT: 'rgb(191, 97, 106)', // Nord11
          foreground: 'rgb(236, 239, 244)',
        },
        border: 'rgb(59, 66, 82)',
        input: 'rgb(59, 66, 82)',
        ring: 'rgb(129, 161, 193)',
        chart: {
          1: 'rgb(136, 192, 208)', // Nord8
          2: 'rgb(143, 188, 187)', // Nord7
          3: 'rgb(163, 190, 140)', // Nord14
          4: 'rgb(235, 203, 139)', // Nord13
          5: 'rgb(180, 142, 173)', // Nord15
        },
        sidebar: {
          DEFAULT: 'rgba(77, 77, 77, 1)', //THIS CHANGES COLOR OF FILESYSTEM TREE BACKGROUND
          foreground: 'rgba(244, 238, 236, 1)',
          primary: 'rgba(182, 23, 161, 1)',
          'primary-foreground': 'rgba(64, 47, 46, 1)',
          accent: 'rgba(54, 81, 109, 1)',
          'accent-foreground': 'rgb(236, 239, 244)',
          border: 'rgb(59, 66, 82)',
          ring: 'rgb(129, 161, 193)',
        },
      },
      radius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'calc(var(--radius-sm) - 4px)',
      },
      boxShadow: {
      'neumorph': '0 2px 6px rgba(39,44,54,0.4), 0 -2px 6px rgba(79,86,102,1), 2px 0 6px rgba(39,44,54,1), -2px 0 6px rgba(79,86,102,0.5)',
      'neumorph-insert': 'inset 0 2px 5px rgba(39,44,54,0.35), inset 0 -2px 5px rgba(79,86,102,.25), inset 2px 0 5px rgba(39,44,54,0.3), inset -2px 0 5px rgba(79,86,102,0.2)',
      'neumorph-sm': '0 1px 3px rgba(39,44,54,0.35), 0 -1px 3px rgba(79,86,102,0.1), 1px 0 3px rgba(39,44,54,1), -1px 0 3px rgba(79,86,102,0.2)',

      },
    },
  },
  plugins: ["tw-animate-css"],
}

