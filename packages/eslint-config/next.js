import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Rastgele hex renk kullanma; packages/ui design token kullan.',
        },
      ],
    },
  },
];
