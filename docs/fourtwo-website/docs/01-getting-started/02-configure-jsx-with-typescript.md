---
title: Fourtwo - Configuring the JSX transformer
titleTemplate: ':title'
---

# JSX Engine

Fourtwo uses a specialized jsx engine to declare and generate IaC resources. 

To use the available components, Javascript must be configured to use the Fourtwo jsx definitions. 

---

# Configuring JSX with pragma directive
Pragma comments are used as 'hints' to the javascript interpreter about the source code. 

```tsx
/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */
```
_Note: the pragma comment only affects the current file._

---

# Configuring JSX with tsconfig.json
The typescript language server can be configured to use a custom JSX engine. By specifying the JSX definition in `tsconfig.json`, `tsc` will automatically infer Fourtwo types for `.tsx/.jsx` files in that project.


```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "@levicape/fourtwo",
		"module": "ESNext",
		"moduleResolution": "bundler"
	}
}
```