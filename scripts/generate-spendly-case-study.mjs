import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'project_files_template copy 3.html');
const outputPath = path.join(projectRoot, 'spendly.html');

function replaceExact(source, searchValue, replaceValue) {
  if (!source.includes(searchValue)) {
    throw new Error(`Expected content not found:\n${searchValue}`);
  }

  return source.replace(searchValue, replaceValue);
}

const template = await readFile(templatePath, 'utf8');
let html = template;

html = html.replaceAll('#8e5864', '#2B7FFF');
html = html.replaceAll('to-purple-600', 'to-sky-500');

html = replaceExact(html, '<title>PROJECT | NEON FLUX</title>', '<title>Spendly | Praful M.</title>');
html = replaceExact(html, '← Back to Galaxy', '← Back to Work');
html = replaceExact(html, '<span>2024</span>', '<span>2025</span>');
html = replaceExact(html, '<span>WEB3</span>', '<span>MOBILE APP</span>');
html = replaceExact(html, 'NEON<br>FLUX', 'SPEND<br>LY');
html = replaceExact(
  html,
  'A decentralized dashboard that breathes. Visualizing blockchain data through organic particle systems.',
  'Track every rupee. Built for real life — works offline, syncs everywhere, and fits in your pocket.',
);
html = replaceExact(
  html,
  'src="https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80"',
  'src="spendly-assets/screen-dashboard.png"',
);
html = replaceExact(html, 'alt="Project Visual"', 'alt="Spendly Dashboard"');

html = replaceExact(html, 'Bridging Biology & Syntax', 'Making finance feel human.');
html = replaceExact(
  html,
  'Nexus Labs required a visual identity that bridged the gap between organic biology and synthetic intelligence. The goal was to create a digital environment that felt "alive" yet precisely engineered.',
  'Most expense trackers feel like spreadsheets with extra steps. Spendly was built to feel like a natural part of your day — quick to open, quick to log, and honest about your money without guilt-tripping you.',
);

const deliverablesPattern = /<ul class="font-mono text-sm text-gray-300 space-y-4">[\s\S]*?<\/ul>/;
html = html.replace(
  deliverablesPattern,
  `<ul class="font-mono text-sm text-gray-300 space-y-4">
                        <li class="flex items-center gap-3"><span class="w-1.5 h-1.5 bg-[#2B7FFF] rounded-full"></span> Local-first with cloud sync</li>
                        <li class="flex items-center gap-3"><span class="w-1.5 h-1.5 bg-[#2B7FFF] rounded-full"></span> Works fully offline</li>
                        <li class="flex items-center gap-3"><span class="w-1.5 h-1.5 bg-[#2B7FFF] rounded-full"></span> Google Play &amp; App Store</li>
                        <li class="flex items-center gap-3"><span class="w-1.5 h-1.5 bg-[#2B7FFF] rounded-full"></span> Shared family budgets</li>
                    </ul>`,
);

html = replaceExact(
  html,
  'src="https://images.unsplash.com/photo-1558494949-ef526b0042a0?auto=format&fit=crop&w=1200"',
  'src="spendly-assets/desktop-dashboard.png"',
);
html = replaceExact(html, 'alt="System Architecture"', 'alt="Spendly Dashboard Overview"');
html = replaceExact(html, 'FIG 1.0 SYSTEM ARCHITECTURE', 'FIG 1.0  DASHBOARD — LIVE SPEND OVERVIEW');
html = replaceExact(html, 'Scalable Infrastructure', 'Built for your phone, not your browser.');
html = replaceExact(
  html,
  'The architecture was designed for high-frequency data updates. Using WebSocket connections for real-time feeds and a dedicated WebGL rendering pipeline, we achieved 60fps performance on standard devices.',
  'Spendly is a Capacitor-wrapped React app backed by Supabase for cloud sync and Dexie for offline-first storage. Every write is optimistic — the UI updates instantly while sync happens in the background. Open it on Android, iOS, or the web — your data is always there.',
);
html = replaceExact(
  html,
  'src="https://images.unsplash.com/photo-1614726365203-c029fa853a69?auto=format&fit=crop&w=2000"',
  'src="spendly-assets/desktop-history.png"',
);
html = replaceExact(html, 'alt="Design Process"', 'alt="Spendly History Screen"');
html = replaceExact(html, 'FIG 2.0 INTERFACE DESIGN SYSTEM', 'FIG 2.0  TRANSACTION HISTORY — SEARCH, FILTER, EXPORT');

html = replaceExact(html, 'CyberDynamics', 'Personal Project');
html = replaceExact(html, 'Lead Designer', 'Solo Developer');
html = replaceExact(html, '4 Weeks', '8 Weeks');

html = replaceExact(
  html,
  'We implemented a rigorous design-to-code workflow. By utilizing Tailwind CSS for styling and React Three Fiber for the 3D elements, we maintained a 1:1 fidelity with the original Figma prototypes.',
  'Every screen was designed mobile-first and tested on real devices. The UI uses a custom design system — no component library — with CSS variables for dark and light mode, tabular number fonts for amounts, and spring animations via Framer Motion for every interaction.',
);
html = replaceExact(
  html,
  'The result is a seamless dashboard that not only looks futuristic but performs with the reliability of enterprise software. Every pixel was calculated to ensure zero layout shifts during data streaming.',
  'The result is an app that feels native on Android and iOS while sharing a single codebase with the web version. Lighthouse scores: Performance 91, Accessibility 100, Best Practices 100, SEO 100.',
);

const stackPattern = /<div class="scroll-fade-y w-full h-full overflow-y-auto p-4 space-y-2" data-lenis-prevent>[\s\S]*?<div class="h-8"><\/div>\s*<\/div>/;
html = html.replace(
  stackPattern,
  `<div class="scroll-fade-y w-full h-full overflow-y-auto p-4 space-y-2" data-lenis-prevent>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">01</span><span class="font-display font-bold">React + TypeScript</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">02</span><span class="font-display font-bold">Capacitor (Android + iOS)</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">03</span><span class="font-display font-bold">Supabase (Auth + DB + Storage)</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">04</span><span class="font-display font-bold">Dexie.js (Offline Cache)</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">05</span><span class="font-display font-bold">Framer Motion</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">06</span><span class="font-display font-bold">Vite + PWA Plugin</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">07</span><span class="font-display font-bold">Tailwind CSS</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">08</span><span class="font-display font-bold">Custom SVG Charts</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">09</span><span class="font-display font-bold">Vercel (Web Deploy)</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">10</span><span class="font-display font-bold">Google Play Store</span></div>
                            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition cursor-default"><span class="font-mono text-[#2B7FFF] text-xs">11</span><span class="font-display font-bold">Apple App Store</span></div>
                            <div class="h-8"></div>
                        </div>`,
);

const gallerySection = `
        <section class="py-24 px-6 md:px-24 bg-[#0a0a0a] border-t border-white/5">
            <div class="mb-14 max-w-3xl reveal-up">
                <span class="font-mono text-[#2B7FFF] mb-6 block tracking-widest">THE SCREENS</span>
                <h2 class="text-3xl md:text-5xl font-display font-bold text-white">Every screen, considered.</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
                <article class="reveal-stagger rounded-[28px] border border-white/10 bg-black/40 p-4">
                    <div class="overflow-hidden rounded-[22px] border border-white/10 bg-[#11151e]">
                        <img src="spendly-assets/screen-dashboard.png" alt="Spendly dashboard screen" class="w-full h-auto block" />
                    </div>
                    <p class="mt-4 font-mono text-xs tracking-[0.24em] text-gray-500">DASHBOARD</p>
                </article>
                <article class="reveal-stagger rounded-[28px] border border-white/10 bg-black/40 p-4">
                    <div class="overflow-hidden rounded-[22px] border border-white/10 bg-[#11151e]">
                        <img src="spendly-assets/screen-history.png" alt="Spendly history screen" class="w-full h-auto block" />
                    </div>
                    <p class="mt-4 font-mono text-xs tracking-[0.24em] text-gray-500">HISTORY</p>
                </article>
                <article class="reveal-stagger rounded-[28px] border border-white/10 bg-black/40 p-4">
                    <div class="overflow-hidden rounded-[22px] border border-white/10 bg-[#11151e]">
                        <img src="spendly-assets/screen-quickadd.png" alt="Spendly quick add screen" class="w-full h-auto block" />
                    </div>
                    <p class="mt-4 font-mono text-xs tracking-[0.24em] text-gray-500">QUICK ADD</p>
                </article>
                <article class="reveal-stagger rounded-[28px] border border-white/10 bg-black/40 p-4">
                    <div class="overflow-hidden rounded-[22px] border border-white/10 bg-[#11151e]">
                        <img src="spendly-assets/screen-analysis.png" alt="Spendly analysis screen" class="w-full h-auto block" />
                    </div>
                    <p class="mt-4 font-mono text-xs tracking-[0.24em] text-gray-500">ANALYSIS</p>
                </article>
                <article class="reveal-stagger rounded-[28px] border border-white/10 bg-black/40 p-4">
                    <div class="overflow-hidden rounded-[22px] border border-white/10 bg-[#11151e]">
                        <img src="spendly-assets/screen-profile.png" alt="Spendly profile screen" class="w-full h-auto block" />
                    </div>
                    <p class="mt-4 font-mono text-xs tracking-[0.24em] text-gray-500">PROFILE</p>
                </article>
            </div>
        </section>

`;

html = replaceExact(
  html,
  '        <footer class="py-24 px-6 flex justify-center items-center bg-[#0a0a0a] border-t border-white/5">',
  `${gallerySection}        <footer class="py-24 px-6 flex justify-center items-center bg-[#0a0a0a] border-t border-white/5">`,
);

html = replaceExact(html, 'href="project-2.html"', 'href="index.html"');
html = replaceExact(html, '>CYBER DUST<', '>BACK TO WORK<');

await writeFile(outputPath, html, 'utf8');

console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
