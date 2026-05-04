module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='+'] > Literal[value=/\\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\\b/i]",
          message: 'SQL concatenation detected — use parameterized queries ($1, $2, ...) instead of string concatenation.',
        },
      ],
    },
  },
];
