const fs = require('fs');


//calculate Rolling hash
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

//compute hashed and search using rabin karp

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

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

  stream.on('data', (chunk) => {
    for (const char of chunk) {
      if (capturingLine) {
        lineBuffer.push(char);
        if (char === '\n') {
          console.log(lineBuffer.join('').trim());
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
      console.log(lineBuffer.join('').trim());
    }
  });

  stream.on('error', (err) => {
    console.error('Error reading file:', err);
  });
}

// Command-line execution: node extract_logs.js <file_path> <YYYY-MM-DD>
if (process.argv.length !== 4) {
  console.log('Usage: node logExtractor.js <file_path> <YYYY-MM-DD>');
} else {
  const filePath = process.argv[2];
  const targetDate = process.argv[3];

  
  // Define the output file path in the ../output directory
  const outputFilePath = path.join(__dirname, '../output', `${targetDate}_logs.txt`);
  
  findLogsByDateStream(filePath, targetDate, outputFilePath);
}
