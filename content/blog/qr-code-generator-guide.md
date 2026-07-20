---
title: 'QR Codes Are Everywhere — Here is How to Create Them Without Compromising Privacy'
date: '2026-07-17'
category: 'Guide'
excerpt: 'Create custom QR codes for URLs, WiFi credentials, and more — entirely in your browser. Privacy-focused tips for businesses, marketers, and developers.'
author: 'Michael Schneider'
readingTime: '5 min read'
---

# QR Codes Are Everywhere — Here is How to Create Them Without Compromising Privacy

A few years ago, I was helping a friend set up a small caf in Accra. He wanted a QR code on every table so customers could view the menu on their phones. Simple enough. I went online, found a "free" QR code generator, typed in the menu URL, and downloaded the image. What I did not realize at the time was that every single one of those QR codes — and the URL embedded in them — had been sent to the generator's servers and stored.

That experience stuck with me. Many free QR code generators track usage, collect data, or insert ads into your codes. Some require subscriptions for high-resolution downloads. None of that sat right with me, especially for a business owner who simply wanted customers to see a menu. When I built SaveVex, making a QR code generator that works entirely offline was one of my first priorities.

## What This Tool Does

The SaveVex QR Code Generator creates QR codes from URLs, plain text, or WiFi network credentials. You can customize the colors, embed a logo in the center, and choose from multiple error correction levels that determine how much damage a QR code can survive and still scan correctly. The output can be downloaded as PNG for web use, SVG for print and scaling, or PDF for documents and signage.

All of this happens in your browser. Nothing is uploaded to a server. No data is logged. No account is required. You generate the code, download it, and SaveVex forgets it ever happened.

## How to Generate a QR Code with SaveVex

### 1. Choose Your Input Type

Decide what the QR code should encode. The most common options are a URL (for directing people to a webpage) or WiFi credentials (for guest network access). Plain text works for simple messages like a phone number or address.

For WiFi credentials, you will need the network name (SSID), the password, and the encryption type (WPA2, WEP, or none). SaveVex formats these into a standard configuration string that any modern phone can read.

### 2. Customize the Design

Set the foreground and background colors. Dark foreground colors on a light background scan most reliably. If you want to add your logo, upload a small image — the tool centers it in the QR code. Keep the logo small relative to the total code area so the error correction can compensate for the obscured modules.

### 3. Set the Error Correction Level

QR codes have four error correction levels. The lowest level allows the code to be scanned even if about 7% of it is damaged. The highest level pushes that tolerance to approximately 30%. I typically use the second-highest level for printed materials and the highest level when embedding a logo.

### 4. Download Your Code

Choose PNG if you are using the code on a website or social media. Choose SVG if you are printing at different sizes — vector graphics scale infinitely without pixelation. Choose PDF for documents, flyers, or any printed collateral where you want the code embedded in a page layout.

## Real-World Use Cases

Since building that first menu QR code for my friend's caf, I have used QR codes in more contexts than I expected. For the launch of SaveVex, I generated a QR code for the homepage and printed it on stickers that I handed out at a local tech meetup. Generating the code myself, without relying on a third party, gave me complete control over the design and destination URL.

I also built a guest WiFi onboarding flow for a co-working space in my neighborhood. Instead of printing the WiFi password on a whiteboard, we print a QR code that encodes the network credentials. Guests scan it with their phone camera and connect automatically. When the network credentials change, we generate a new code and reprint. The whole process takes five minutes.

For developers and designers, QR codes are useful in prototype testing. I have placed QR codes on wireframes so stakeholders can open the prototype on their own phones rather than passing a tablet around. It is a small thing, but it makes usability testing sessions smoother.

## Pro Tips and Common Mistakes

**Use the highest practical error correction level.** If you are printing QR codes on stickers or any surface that might get scratched, the extra redundancy can mean the difference between a code that scans and one that frustrates customers. For digital-only use, the lowest level is usually sufficient.

**Test with multiple phones before printing in bulk.** Not all cameras read QR codes equally well. Older phones need larger, higher-contrast codes. Test on at least three different devices before ordering printed materials.

**Choose SVG for any use case involving print.** PNG is a raster format — enlarging it causes pixelation. SVG is vector and scales to any size without quality loss. A single SVG file works on a business card and a billboard.

**Dark foreground, light background, always.** QR code scanners work by detecting the contrast between modules. Dark blue, dark green, or black on a white or very light background gives the best results. Light colors on dark backgrounds are unreliable and should be avoided.

**Always include a human-readable label near the QR code.** A QR code with no context is confusing. Tell people what they will get when they scan: "View our menu," "Connect to WiFi," "Download the app." I have seen marketing materials with a bare QR code that no one scans.

A common mistake I see is making QR codes too small. A printed QR code should be at least 2 x 2 centimeters (roughly 0.8 x 0.8 inches). Smaller than that, and many phone cameras struggle to focus on the pattern, especially in low light.

## Why This Tool Is Different

Most QR code generators on the web work by sending your data to a server, which generates the code and sends it back. This means the operator of that server has a record of every URL, every WiFi password, and every piece of text you have encoded. With SaveVex, the entire generation process runs in your browser. Your data never touches a network. I built it this way not because it was easier — it was actually harder — but because privacy should be the default, not a premium feature.

## Conclusion

QR codes are not going anywhere. They are built into phone cameras, restaurant tables, product packaging, and event signage worldwide. Having a reliable, private, and free way to create them is essential for anyone who works with digital or printed materials. The SaveVex QR Code Generator gives you that capability without tracking, without accounts, and without compromise. Give it a try at the [QR Code Generator](/tools/utility/qr-generator) page.
