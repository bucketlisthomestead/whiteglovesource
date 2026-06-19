#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'walkthrough-output');
const finalMp4 = path.join(outputDir, 'walkthrough.mp4');
const resultsDir = path.join(root, 'walkthrough-results');

if (!ffmpegPath) {
  console.error('ERROR: ffmpeg-static binary not found. Run: npm install');
  process.exit(1);
}

function findVideoWebm(dir = resultsDir) {
  if (!fs.existsSync(dir)) return null;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findVideoWebm(full);
      if (nested) return nested;
    } else if (entry.name === 'video.webm') {
      return full;
    }
  }
  return null;
}

function resolveVideo(input) {
  if (!input) return findVideoWebm();

  const trimmed = input.trim();
  if (!trimmed) return findVideoWebm();

  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }

  const rel = trimmed.replace(/^(\.\.\/)+/, '');
  const fromRoot = path.join(root, rel);
  if (fs.existsSync(fromRoot)) return fromRoot;

  const inResults = trimmed.match(/walkthrough-results[/\\].+/);
  if (inResults) {
    const candidate = path.join(root, inResults[0].replace(/\\/g, path.sep));
    if (fs.existsSync(candidate)) return candidate;
  }

  return findVideoWebm();
}

const videoAbs = resolveVideo(process.argv[2]);

if (!videoAbs) {
  console.error('ERROR: Pass path to video.webm or run Playwright first.');
  console.error(`       Looked in: ${resultsDir}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

console.log(`==> Video: ${path.relative(root, videoAbs)}`);
console.log(`==> Exporting → ${finalMp4}`);

execFileSync(
  ffmpegPath,
  [
    '-y',
    '-i',
    videoAbs,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '22',
    '-an',
    finalMp4,
  ],
  { stdio: 'inherit' },
);

console.log(`Done: ${finalMp4}`);
