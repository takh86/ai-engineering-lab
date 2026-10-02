# Third-party notices — built-in adult-sites list

The file `rulesets/base_adult.json` in the extension package is generated from the list snapshot `adult-domains.txt.gz`
(242,750 domain names, retrieved 2026-10-02). It is the union of exactly two upstream list files, each published in a repository under an explicit
licence that allows use, modification and redistribution, commercial use included. Their copyright and permission notices follow, as the licences require.
The same information with pinned commits and hashes: `data/base-list/PROVENANCE.json` in the source repository.

1. **ShadowWhisperer BlockLists** — file `Lists/Adult` — https://github.com/ShadowWhisperer/BlockLists — commit `1404d49b73d3c986da869b33c03a9e617437e0df`
   (2026-10-01), file SHA-256 `de136908d2b12b31ece5d5bee9e74748b364977a27840fab9a616f2e4b70b3d7` — **The Unlicense**.
2. **Sinfonietta hostfiles** — file `pornography-hosts` — https://github.com/Sinfonietta/hostfiles — commit `46f3097d7bcfc9eea323fe365074dfd771d0d17c`
   (2026-09-08), file SHA-256 `d5c31a7ee9f1920df47044270449ad42a1b09ad4f3b608410383abaabb27fa1d` — **MIT License, Copyright (c) 2016 Sinfonietta**.

The extension changes the data only by normalising host names, merging the two files and removing entries already covered by a listed parent domain.
No other list is used.

---

## ShadowWhisperer BlockLists — The Unlicense

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>

---

## Sinfonietta hostfiles — The MIT License

The MIT License (MIT)

Copyright (c) 2016 Sinfonietta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
