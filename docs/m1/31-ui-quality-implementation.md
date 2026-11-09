# UI quality implementation: M1 only

Owner direction: restrained enterprise application, compact table-led desktop workflows and equivalent mobile views, consistent tokens, shadcn/ui foundation, synthetic content only. No operational workflow or account implementation.

Official component sources downloaded with explicit approval from https://ui.shadcn.com/r/styles/new-york-v4/{button,table,badge,input,skeleton,separator,dialog}.json, inspected as source, not executed as a CLI. Local adaptations retain source attribution headers. cn imports use local utility; consolidated Radix imports replaced with exact individual primitives. Decorative animations/shadows removed; dialog close uses text instead of installing an icon library. Need application-specific token/sizing/focus integration; installation alone establishes no design quality/accessibility verdict.

Pinned new dependencies: class-variance-authority0.7.1, clsx2.1.1, tailwind-merge3.7.0, @radix-ui/react-slot1.5.0, @radix-ui/react-dialog1.3.1, @radix-ui/react-separator1.2.0. Exact metadata/React peers and npm bulk advisory queries checked with approval; no matches returned for direct versions. npm install --save-exact <six pins> --ignore-scripts --cache .cache/npm --no-fund exit0;388 audited;0 vulnerabilities reported (ui-dependency-install.log). No lifecycle scripts or remote fonts/browser binaries enabled.

Current work: Frontend owns application layouts/tokens/design-system examples. Orbit owns dependency/primitives integration and verification. Independent Security and QA review follow sequentially. Screenshots require rendered local screens; earlier browser/computer restriction must be resolved before using those integrations. No screenshots or visual pass claimed yet.
