---
title: 'What I Learned Building a PDF Merger: The Details Most Guides Skip'
date: '2026-07-06'
category: 'Guide'
excerpt: 'Real insight from building the SaveVex PDF merge tool — why page ordering matters, how mixed page sizes work, and the mistakes that make merged PDFs look broken.'
author: 'Michael Schneider'
readingTime: '5 min read'
---

# What I Learned Building a PDF Merger: The Details Most Guides Skip

When I set out to build SaveVex's PDF merge tool, I thought it would be straightforward: take pages from file A, append pages from file B, done. It wasn't that simple. Merging PDFs correctly means handling mixed page sizes, preserving hyperlinks, maintaining searchable text, and keeping file sizes reasonable. Here's what building that tool taught me — and what it means when you're merging your own documents.

## The First Thing That Surprised Me: Page Order Is Everything

It sounds obvious, but the most common merge mistake I see isn't technical — it's ordering. Someone drags in five files, hits merge, and only later realizes Chapter 3 landed before Chapter 2. By then, they've already sent the document.

My advice, born from seeing this happen repeatedly: name your files with numeric prefixes before you even open the merge tool. `01-Introduction.pdf`, `02-Methods.pdf`, `03-Results.pdf`. It takes 30 seconds and eliminates ordering errors entirely. The tool will sort by filename, and you'll know at a glance that everything is in sequence.

If you don't rename files beforehand, at least drag them into position one by one and mentally verify: "What page follows what?" It's the 30 seconds of verification that saves the embarrassment of a mis‑ordered document.

## Mixed Page Sizes: The Hidden Complexity

Here's something I didn't fully appreciate before building the tool: when you merge an A4 document with a letter-sized document, what should happen?

The answer is: each page keeps its original size. The merged PDF will have some pages at 210×297mm and others at 216×279mm. Most PDF viewers handle this fine — they display each page at its native dimensions. But not all do. Some older viewers scale everything to the first page's size, which can result in content being cropped or surrounded by awkward white space.

If you're merging documents with different page sizes and the output will be printed, check your printer settings. Most printers have a "Fit to Page" or "Shrink Oversized Pages" option. Turn it on. It solves the mixed-size problem without you having to resize individual files beforehand.

## Why Some Merged PDFs End Up Larger Than Expected

Merging shouldn't increase total file size — it should be roughly the sum of the parts. But I've seen merged PDFs come out significantly larger, and here's why: duplicate resources.

If you're merging three chapters of a report that all use the same corporate template (same fonts, same logo), a naive merge embeds those fonts and that logo three separate times. The result is a file larger than the sum of its parts.

A well-built merge tool — and I made sure SaveVex does this — deduplicates shared resources. The logo gets stored once. Each font gets subsetted once across the entire document. The result is often smaller than the individual files combined.

This is also why I recommend merging before compressing, not after. If you merge first, the compressor can work across the whole document, finding and optimizing redundancies that span the original files. Compress individual files first, and you lose that cross‑document optimization opportunity.

## When Merging Goes Wrong: Three Scenarios

**Password-protected files in the mix.** Browser-based tools can't decrypt password-protected PDFs — and that's actually a good thing, because it means your files aren't being sent anywhere to be unlocked. Remove the password from each file first, merge, then re-apply protection to the combined document if needed.

**One corrupted file in the batch.** I've seen this happen: nine perfectly fine PDFs and one that's subtly corrupted. The merge tool processes all ten, but the output is broken and you can't tell which file caused it. If a merge produces unexpected results, merge files one at a time — add File A, merge. Add File B, merge. When the output breaks, you've found the culprit.

**Hyperlinks that stop working.** Most merge tools preserve internal links (links to other pages within the same PDF), but some break cross-document links or external URLs. If your merged PDF has links that matter, test a few of them after merging before you share the file.

## Pro Tips

**Merge first, compress second.** If you need to both merge and compress, always merge first. The compressor can then optimize the entire document holistically, saving more space than compressing individual files beforehand.

**Check the page count.** After merging, the total page count should equal the sum of your source files' pages. If it doesn't, a file was dropped or duplicated. This quick sanity check catches most merge errors.

**Keep your source files.** Don't delete the individual PDFs after merging. You might need to redo the merge with a different order, or extract a specific section later. Storage is cheap; losing the original organization is not.

**Use drag-to-reorder, not hope.** Most merge tools let you drag files to rearrange them. Use that feature. Don't assume the upload order is the merge order — explicitly verify it before clicking merge.

**For legal and archival documents, keep unmerged originals.** A merged document is great for sharing, but in a dispute or audit, individual source files with their original metadata and timestamps carry more weight than a recombined version.

---
