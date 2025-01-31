const fs = require('fs');
const path = require('path');

class RollingHash {
  constructor(windowSize, base = 256, mod = 1e9 + 7) {
    this.windowSize = windowSize;
    this.base = base;
    this.mod = mod;
    this.hash = 0;
    this.window = [];
    this.basePower = 1;
    for (let i = 0; i < windowSize - 1; i++) {
      this.basePower = (this.basePower * this.base) % this.mod;
    }
  }

  update(char) {
    if (this.window.length === this.windowSize) {
      const oldest = this.window.shift();
      this.hash = (this.hash - (oldest.charCodeAt(0) * this.basePower) % this.mod + this.mod) % this.mod;
    }
    const code = char.charCodeAt(0);
    this.hash = (this.hash * this.base + code) % this.mod;
    this.window.push(char);
    return this.hash;
  }

  reset() {
    this.hash = 0;
    this.window = [];
  }

  getWindow() {
    return this.window.join('');
  }
}

function findLogsByDateStream(filePath, targetDate) {
  // Precompute target hash
  const targetHash = new RollingHash(targetDate.length);
  for (const c of targetDate) {
    targetHash.update(c);
  }
  const targetHashValue = targetHash.hash;

  // Initialize stream processor
  const rh = new RollingHash(targetDate.length);
  let lineBuffer = [];
  let isNewLine = true;
  let charCount = 0;
  let capturingLine = false;

  // Create the output directory if it doesn't exist
  const outputDir = 'output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Define the output file path
  const outputFilePath = path.join(outputDir, `output_${targetDate}.txt`);

  // Create a write stream for the output file
  const outputStream = fs.createWriteStream(outputFilePath, { encoding: 'utf8' });

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

  stream.on('data', (chunk) => {
    for (const char of chunk) {
      if (capturingLine) {
        lineBuffer.push(char);
        if (char === '\n') {
          // Write the line to the output file
          outputStream.write(lineBuffer.join('').trim() + '\n');
          lineBuffer = [];
          capturingLine = false;
          isNewLine = true;
          charCount = 0;
          rh.reset();
        }
        continue;
      }

      if (char === '\n') {
        isNewLine = true;
        charCount = 0;
        rh.reset();
        continue;
      }

      if (isNewLine && charCount < targetDate.length) {
        rh.update(char);
        charCount++;
        lineBuffer.push(char);

        if (charCount === targetDate.length) {
          if (rh.hash === targetHashValue && rh.getWindow() === targetDate) {
            capturingLine = true;
          } else {
            lineBuffer = [];
            isNewLine = false;
            charCount = 0;
            rh.reset();
          }
        }
      }
    }
  });

  stream.on('end', () => {
    if (capturingLine) {
      outputStream.write(lineBuffer.join('').trim() + '\n');
    }
    // Close the output stream after processing
    outputStream.end();
  });

  stream.on('error', (err) => {
    console.error('Error reading file:', err);
  });
}

// Command-line execution: node logExtractor.js <file_path> <YYYY-MM-DD>
if (process.argv.length !== 4) {
  console.log('Usage: node logExtractor.js <file_path> <YYYY-MM-DD>');
} else {
  const filePath = process.argv[2];
  const targetDate = process.argv[3];
  findLogsByDateStream(filePath, targetDate);
}
