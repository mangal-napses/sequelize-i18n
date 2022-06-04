module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  env: {
    commonjs: true,
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  plugins: ['babel', 'import'],
  settings: {
    'import/extensions': ['error', 'always', {
      js: 'never',
    }],
    'import/resolver': {
      node: {
        extensions: ['.js'],
        moduleDirectory: [
          'node_modules',
          './src/',
        ],
      },
    },
    'no-param-reassign': ['error', {
      props: true,
      ignorePropertyModificationsFor: [
        'state', // for vuex state
        'acc', // for reduce accumulators
      ],
    }],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'linebreak-style': ['error', 'unix'],
    'max-len': ['error', {
      code: 256,
      tabWidth: 2,
      ignoreComments: true,
      ignoreTrailingComments: true,
      ignoreRegExpLiterals: true,
    }],
  },
};
