/** Small safe expression evaluator for the on-screen calculator: + - * / ^ ( ) and unary minus. */
export function evaluateExpression(src: string): number {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const eat = (c: string) => {
    if (s[i] === c) {
      i++;
      return true;
    }
    return false;
  };
  function number(): number {
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error('Expected number');
    const n = Number(s.slice(start, i));
    if (Number.isNaN(n)) throw new Error('Bad number');
    return n;
  }
  function atom(): number {
    if (eat('(')) {
      const v = expr();
      if (!eat(')')) throw new Error('Missing )');
      return v;
    }
    if (eat('-')) return -atom();
    if (eat('+')) return atom();
    return number();
  }
  function power(): number {
    const b = atom();
    if (eat('^')) return Math.pow(b, power());
    return b;
  }
  function term(): number {
    let v = power();
    for (;;) {
      if (eat('*')) v *= power();
      else if (eat('/')) v /= power();
      else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  const v = expr();
  if (i !== s.length) throw new Error(`Unexpected '${peek()}'`);
  if (!Number.isFinite(v)) throw new Error('Not a finite number');
  return v;
}
