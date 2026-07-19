---
title: 'Does SaveVex Collect or Record User Data?'
date: '2026-07-10'
category: 'Guide'
excerpt: 'A clear explanation of SaveVex privacy practices. Learn what data we do and do not collect, how local processing keeps your files safe, and what you can expect.'
author: 'Michael Schneider'
readingTime: '4 min read'
---

# Does SaveVex Collect or Record User Data?

The short answer is **no.** SaveVex does not collect, record, or store your files or personal data. Not a little bit. Not "anonymized in the cloud." Not "only for improving the service." **Nothing.**

We know that sounds like a bold claim — especially when so many online tools are built on the business model of harvesting user data. But SaveVex isn't most online tools, and the reason we can make that promise comes down to how the platform is built.

## How Local Processing Protects Your Privacy

Every file you process on SaveVex — whether it's a PDF you're merging, an image you're cropping, or a document you're converting — stays entirely on your device. Here's what actually happens when you use a SaveVex tool:

1. You drag and drop a file into the browser.
2. The tool reads the file using the browser's built-in `FileReader` API.
3. Processing happens using WebAssembly engines and native browser capabilities that run directly on your computer.
4. The finished result is saved back to your downloads folder.

At no point in this process is your file sent to a remote server. There **is** no upload step. There **is** no cloud processing pipeline. Your file data stays in your browser's memory from start to finish, and once you close the tab, it's gone.

This isn't a privacy policy that we enforce through rules and promises — it's enforced by **architecture.** We simply don't have servers that receive your files, so we couldn't collect them even if we wanted to.

## What Data Does SaveVex Actually Collect?

Almost nothing. And what little we do collect is completely anonymous.

SaveVex uses two lightweight analytics services: **Vercel Analytics** and **Google Analytics.** These tell us things like how many people visited the homepage, which tools are most popular, and whether visitors are on mobile or desktop. Neither service uses cookies, fingerprinting, or any form of personal identification. We see aggregate numbers — "1,200 people used the PDF merge tool this week" — not individual user behavior.

We also use **Google AdSense** to display ads on the site. AdSense may use cookies to serve relevant ads based on browsing history. You can manage or disable ad personalization through Google's Ad Settings at any time.

Here's what we **never** collect:

- Your name, email address, or any personal identifiers
- The contents of files you process
- Your IP address (anonymized at the analytics level)
- Your location beyond country-level aggregation
- Any form of browsing history outside of SaveVex

## What SaveVex Never Does

Beyond what we don't collect, here's what SaveVex will **never** do:

- **Never sell your data.** We don't have a data marketplace, and we never will. We have nothing to sell because we don't collect anything personal.
- **Never require sign-up.** Creating an account for basic file processing is unnecessary friction, and it would force us to store personal information. We'd rather not.
- **Never store your files.** There's no "recent files" database on our servers. Your documents exist only in your browser tab.
- **Never use your content for training.** We don't train AI models on user files — a practice some services bury in their terms of service.
- **Never share with third parties.** We have nothing to share.

> **Our privacy commitment:** SaveVex is designed so that the most private thing you can do — keep your files entirely on your own device — is also the default behavior. You don't have to opt into privacy. You're already there.

## How We Keep SaveVex Free

If we're not selling data and we don't charge for tools, how does SaveVex stay online? Through a few honest revenue streams that don't compromise your privacy:

- **Non-intrusive advertising** via Google AdSense, displayed alongside tools.
- **Affiliate links** — if we recommend a related service or product and you choose to purchase through our link, we may earn a small commission at no cost to you.
- **Future premium features** — advanced capabilities like cloud sync, team workspaces, and API access may be offered as optional paid upgrades down the road. The core tools you use today will remain free, forever.

None of these revenue streams require us to collect, store, or share your files. They allow us to keep the lights on while respecting the privacy-first approach that defines SaveVex.

## Privacy Tips for Using Any Online Tool

While SaveVex is designed with privacy at its core, here are some general best practices for staying safe online:

- **Check where processing happens.** If a tool uploads your file to a server, assume that server may retain a copy. Look for tools that advertise "client-side" or "browser-based" processing.
- **Read the fine print.** Many free tools monetize through data collection. If the privacy policy is vague about what they collect or share, that's a red flag.
- **Clear your browser cache** periodically, especially after working with sensitive documents.
- **Use HTTPS.** SaveVex enforces HTTPS, and you should avoid any file processing tool that doesn't.

---
**About the Author**
![Michael Schneider](/images/authors/michael-schneider.jpg)
**Michael Schneider** is the Founder & CEO of SneiTech Inc., the company behind SaveVex. With over 10 years in software development and file-processing technologies, he builds privacy-first tools. He personally built and uses every tool on SaveVex.
*Connect:* [LinkedIn](https://www.linkedin.com/company/sneitech/) • [X](https://x.com/sneitech)
---

## Final Word on Privacy

SaveVex exists because we believe you should be able to process your files without handing them over to a stranger. The best way to protect your privacy isn't to trust a company's promise — it's to use tools that never receive your files in the first place.

That's SaveVex. Your files, your device, your control.

If you have questions about our privacy practices, we encourage you to read our full Privacy Policy. And if something isn't clear, reach out — we're happy to explain exactly how things work.
