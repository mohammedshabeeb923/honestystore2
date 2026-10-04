const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\SHIBINSHA\\.gemini\\antigravity\\brain\\380392be-468f-4712-9114-47b2782c62fb';
const assetsDir = path.join(__dirname, '..', 'assets');

const mappings = [
  { pattern: /^lays_chips_pack_.*\.jpg$/, dest: 'lays.jpg' },
  { pattern: /^dailee_mango_drink_.*\.jpg$/, dest: 'dailee_mango.jpg' },
  { pattern: /^oreo_cookies_pack_.*\.jpg$/, dest: 'oreo.jpg' },
  { pattern: /^munch_chocolate_box_.*\.jpg$/, dest: 'munch.jpg' },
  { pattern: /^snickers_bar_pack_.*\.jpg$/, dest: 'snickers.jpg' },
  { pattern: /^bournvita_biscuit_pack_.*\.jpg$/, dest: 'bournvita.jpg' },
  { pattern: /^chocos_snack_pack_.*\.jpg$/, dest: 'chocos.jpg' }
];

const brainFiles = fs.readdirSync(brainDir);

mappings.forEach(({ pattern, dest }) => {
  const matches = brainFiles.filter(f => pattern.test(f));
  if (matches.length > 0) {
    const latest = matches.sort().reverse()[0];
    const src = path.join(brainDir, latest);
    const dst = path.join(assetsDir, dest);
    fs.copyFileSync(src, dst);
    const stat = fs.statSync(dst);
    console.log(`Copied ${latest} -> assets/${dest} (${stat.size} bytes)`);
  } else {
    console.warn(`No match found for pattern: ${pattern}`);
  }
});

console.log('Stock photos successfully copied to assets directory!');
