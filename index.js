#!/usr/bin/env node

const message = 'comux is reserved. More soon: a project-scoped agent cockpit for coding work.';

export const name = 'comux';
export const description = message;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(message);
}
