import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('document exposes its language, viewport, theme, and main landmark',()=>{
  assert.match(html,/<html[^>]+lang="[^"]+"/i);
  assert.match(html,/<meta[^>]+name="viewport"/i);
  assert.match(html,/<meta[^>]+name="theme-color"/i);
  assert.match(html,/<main[^>]+id="main-content"/i);
  assert.match(html,/<a[^>]+href="#main-content"[^>]*>[^<]+<\/a>/i);
});

test('images have text alternatives',()=>{
  const images=html.match(/<img\b[^>]*>/gi)||[];
  for(const image of images)assert.match(image,/\balt="[^"]*"/i,`missing alt text: ${image}`);
});

test('dialogs have an accessible name',()=>{
  const dialogs=html.match(/<(?:dialog\b[^>]*|[a-z]+\b[^>]*role="dialog"[^>]*)>/gi)||[];
  assert.ok(dialogs.length>0,'expected at least one dialog');
  for(const dialog of dialogs)assert.match(dialog,/\b(?:aria-label|aria-labelledby)="[^"]+"/i,`unnamed dialog: ${dialog}`);
});

test('icon-only buttons expose an accessible label',()=>{
  const buttons=html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi)||[];
  for(const button of buttons){
    const visible=button.replace(/<[^>]+>/g,'').replace(/&(?:times|hellip|laquo|raquo);/g,'').trim();
    if(!visible)assert.match(button,/\baria-label="[^"]+"/i,`unlabelled icon button: ${button}`);
  }
});
