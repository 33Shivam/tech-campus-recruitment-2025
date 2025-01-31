const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');

const open = promisify(fs.open);
const stat = promisify(fs.stat);
const read = promisify(fs.read);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

async function readNextLine(fd, position, fileSize) {
    const bufferSize = 1024;
    let currentPos = position;
    let foundNewline = false;
    let lineStart = currentPos;

    while (currentPos < fileSize) {
        const buffer = Buffer.alloc(bufferSize);
        const bytesRead = (await read(fd, buffer, 0, bufferSize, currentPos)).bytesRead;
        if (bytesRead === 0) break;

        const newlinePos = buffer.indexOf('\n'.charCodeAt(0));
        if (newlinePos !== -1) {
            lineStart = currentPos + newlinePos + 1;
            foundNewline = true;
            break;
        }
        currentPos += bytesRead;
    }

    if (!foundNewline) {
        lineStart = fileSize;
    }

    if (lineStart >= fileSize) {
        return { dateBuffer: null, newPosition: lineStart };
    }

    const dateBuffer = Buffer.alloc(10);
    const bytesRead = (await read(fd, dateBuffer, 0, 10, lineStart)).bytesRead;
    if (bytesRead < 10) {
        return { dateBuffer: null, newPosition: lineStart };
    }

    return { dateBuffer, newPosition: lineStart };
}


//Binary Search to find the starting position so we dont have to search the entire file for starting date
async function findStartPosition(filePath, targetDate) { 
    const targetBuffer = Buffer.from(targetDate);
    const fd = await open(filePath, 'r');
    const stats = await stat(filePath);
    let low = 0;
    let high = stats.size;
    let startPos = null;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const { dateBuffer, newPosition } = await readNextLine(fd, mid, stats.size);

        if (!dateBuffer) {
            high = mid;
            continue;
        }

        const cmp = dateBuffer.compare(targetBuffer);
        if (cmp < 0) {
            low = newPosition;
        } else {
            high = mid;
        }
    }

    const { dateBuffer } = await readNextLine(fd, low, stats.size);
    if (dateBuffer && dateBuffer.compare(targetBuffer) === 0) {
        startPos = low;
    }

    await fd.close();
    return startPos;
}

//Binary Search to find the ending position so we dont have to search the entire file for starting date
async function findEndPosition(filePath, targetDate, startPos) { 
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];
    const targetBuffer = Buffer.from(nextDayStr);

    const fd = await open(filePath, 'r');
    const stats = await stat(filePath);
    let low = startPos;
    let high = stats.size;
    let endPos = stats.size;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const { dateBuffer, newPosition } = await readNextLine(fd, mid, stats.size);

        if (!dateBuffer) {
            high = mid;
            continue;
        }

        const cmp = dateBuffer.compare(targetBuffer);
        if (cmp < 0) {
            low = newPosition;
        } else {
            high = mid;
        }
    }

    const { dateBuffer } = await readNextLine(fd, low, stats.size);
    if (dateBuffer && dateBuffer.compare(targetBuffer) === 0) {
        endPos = low;
    } else {
        endPos = stats.size;
    }

    await fd.close();
    return endPos;
}

async function extractLogs(inputFile, outputFile, startPos, endPos, targetDate) {
    const inputStream = fs.createReadStream(inputFile, { start: startPos, end: endPos - 1 });
    const rl = readline.createInterface({
        input: inputStream,
        crlfDelay: Infinity
    });
    const writeStream = fs.createWriteStream(outputFile);

    return new Promise((resolve, reject) => {
        rl.on('line', (line) => {
            if (line.startsWith(targetDate)) {
                writeStream.write(line + '\n');
            }
        });

        rl.on('close', () => {
            writeStream.end();
            resolve();
        });

        rl.on('error', reject);
        writeStream.on('error', reject);
    });
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Usage: node extract_logs.js YYYY-MM-DD');
        process.exit(1);
    }

    const targetDate = args[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error('Invalid date format. Use YYYY-MM-DD.');
        process.exit(1);
    }

    const inputFile = 'test_logs.log';
    const outputDir = 'output';
    const outputFile = `${outputDir}/output_${targetDate}.txt`;

    try {
        await mkdir(outputDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }

    const startPos = await findStartPosition(inputFile, targetDate);
    if (startPos === null) {
        await writeFile(outputFile, '');
        console.log(`No logs found for ${targetDate}`);
        return;
    }

    const endPos = await findEndPosition(inputFile, targetDate, startPos);
    await extractLogs(inputFile, outputFile, startPos, endPos, targetDate);
    console.log(`Logs extracted to ${outputFile}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});