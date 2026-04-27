/** @type {import('nextron/types').NextronConfig} */
module.exports = {
  webpack: (config) => {
    config.entry = { background: './main/background.ts' };
    return config;
  },
};
