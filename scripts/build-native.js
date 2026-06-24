const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function buildNative() {
  console.log('Building Rust native library...');
  execSync('cargo build --release', {
    cwd: path.join(__dirname, '../native'),
    stdio: 'inherit'
  });

  const releaseDir = path.join(__dirname, '../native/target/release');
  const files = [
    { src: 'quantix_native.dll', dest: 'quantix_native.node' }, // Windows
    { src: 'libquantix_native.so', dest: 'quantix_native.node' }, // Linux
    { src: 'libquantix_native.dylib', dest: 'quantix_native.node' } // macOS
  ];

  let copied = false;
  for (const file of files) {
    const srcPath = path.join(releaseDir, file.src);
    const destPath = path.join(releaseDir, file.dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${file.src} to ${file.dest}`);
      
      const distDir = path.join(__dirname, '../dist');
      fs.mkdirSync(distDir, { recursive: true });
      fs.copyFileSync(srcPath, path.join(distDir, 'quantix_native.node'));
      console.log(`Copied ${file.src} to dist/quantix_native.node`);
      
      copied = true;
      break;
    }
  }

  if (!copied) {
    console.error('Could not find compiled Rust binary in target/release/ to copy as .node.');
    process.exit(1);
  }
  console.log('Native module build successful!');
}

buildNative();
