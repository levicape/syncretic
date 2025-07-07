# Configuring Typescript Projects to support @levicape/syncretic/jsx-runtime

## tsconfig.json

"jsx" "react-jsx"
"jsxImportSource": "@levicape/syncretic"

## ExamplePipeline.jsx

/** @jsxImportSource @levicape/syncretic */
/** @jsxRuntime automatic */