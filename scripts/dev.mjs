import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const serverEntry = path.join(cwd, 'server', 'index.ts');
let shuttingDown = false;

function prefixStream(stream, label, logger = process.stdout) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim().length > 0) {
        logger.write(`[${label}] ${line}\n`);
      }
    }
  });

  stream.on('end', () => {
    if (buffer.trim().length > 0) {
      logger.write(`[${label}] ${buffer}\n`);
    }
  });
}

function run(command, args, label) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  prefixStream(child.stdout, label);
  prefixStream(child.stderr, label, process.stderr);

  child.on('exit', (code, signal) => {
    if (signal) {
      shutdown(signal, 0);
      return;
    }

    if (code !== 0) {
      process.exitCode = code ?? 1;
      process.stderr.write(`[${label}] exited with code ${code ?? 1}\n`);
      shutdown('SIGTERM', code ?? 1);
    }
  });

  return child;
}

const tasks = [];

if (fs.existsSync(serverEntry)) {
  tasks.push(run(npmCommand, ['run', 'dev:server'], 'api'));
} else {
  process.stderr.write('[dev] server/index.ts is missing, so only the frontend will start.\n');
}

tasks.push(run(npmCommand, ['run', 'dev:web'], 'web'));

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const task of tasks) {
    task.kill(signal);
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
