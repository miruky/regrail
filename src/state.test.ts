import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from './state';

describe('URL状態のエンコード・デコード', () => {
  it('往復しても内容が保たれる', () => {
    const state = { pattern: '(\\d{4})-(\\d{2})', test: '2026-06' };
    expect(decodeState('#' + encodeState(state))).toEqual(state);
  });

  it('記号やスペースを含むパターンも安全に運ぶ', () => {
    const state = { pattern: 'a+ |b? &c%', test: 'x=1 & y=2' };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('先頭の # は省略できる', () => {
    expect(decodeState('re=a&s=b')).toEqual({ pattern: 'a', test: 'b' });
  });

  it('キーが無ければそのキーは返さない', () => {
    expect(decodeState('re=a')).toEqual({ pattern: 'a' });
    expect(decodeState('')).toEqual({});
  });

  it('空文字のキーは空文字として復元する', () => {
    expect(decodeState('re=&s=')).toEqual({ pattern: '', test: '' });
  });
});
